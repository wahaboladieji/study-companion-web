import { prisma } from "@/lib/prisma";
import { expireSubscriptionIfDue } from "@/services/subscription";
import { cacheService } from "@/lib/cache/cache-service";

export type LimitType =
  | "COURSE"
  | "UPLOAD"
  | "STORAGE"
  | "GENERATION"
  | "CHAT";

// Define a default free plan structure according to the PRD
const DEFAULT_FREE_PLAN = {
  name: "FREE",
  courseLimit: 3, // PRD: free tier allows 3 courses
  uploadLimit: 5, // 5 files per course
  aiGenerationLimit: 10,
  chatMessageLimit: 50,
  storageLimit: 50, // 50MB (stored in MB)
};

export class UsageLimitError extends Error {
  constructor(public limitType: LimitType) {
    super(`Usage limit exceeded for ${limitType}`);
    this.name = "UsageLimitError";
  }
}

export async function invalidateUserUsageCache(userId: string): Promise<void> {
  await cacheService.del([
    `plan:user:${userId}`,
    `usage:user:${userId}:COURSE`,
    `usage:user:${userId}:STORAGE`,
    `usage:user:${userId}:UPLOAD`,
    `usage:user:${userId}:GENERATION`,
    `usage:user:${userId}:CHAT`,
  ]);
}

/**
 * Gets the current UTC year and month as the billing period for free users,
 * or the active subscription's billing period if applicable.
 */
export function getCurrentBillingPeriod(subscriptionStart?: Date | null): string {
  const date = subscriptionStart ? new Date(subscriptionStart) : new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function loadEffectivePlan(userId: string) {
  const cacheKey = `plan:user:${userId}`;
  const cachedPlan = await cacheService.get<any>(cacheKey);
  if (cachedPlan) {
    return cachedPlan;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: { status: "ACTIVE" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const activeSubscription = user?.subscriptions[0];

  if (activeSubscription?.plan) {
    const expired = await expireSubscriptionIfDue(activeSubscription);
    if (!expired) {
      await cacheService.set(cacheKey, activeSubscription.plan, 300);
      return activeSubscription.plan;
    }
  }

  // Prefer the FREE plan record from the database when one has been seeded.
  const freePlan = await prisma.plan.findFirst({
    where: { name: "FREE", active: true },
  });

  const resultPlan = freePlan || DEFAULT_FREE_PLAN;
  await cacheService.set(cacheKey, resultPlan, 300);
  return resultPlan;
}

function getPlanLimit(plan: typeof DEFAULT_FREE_PLAN, type: LimitType): number {
  switch (type) {
    case "COURSE":
      return plan.courseLimit;
    case "UPLOAD":
      return plan.uploadLimit;
    case "STORAGE":
      return plan.storageLimit * 1024 * 1024;
    case "GENERATION":
      return plan.aiGenerationLimit;
    case "CHAT":
      return plan.chatMessageLimit;
    default:
      return 0;
  }
}

export async function calculateUsage({
  userId,
  type,
  billingPeriod,
}: {
  userId: string;
  type: LimitType;
  billingPeriod: string;
}) {
  const cacheKey = `usage:user:${userId}:${type}:${billingPeriod}`;
  const cachedUsage = await cacheService.get<number>(cacheKey);
  if (cachedUsage !== null) {
    return cachedUsage;
  }

  // Map LimitType to eventType prefixes or exact matches
  let eventTypePrefix = "";
  switch (type) {
    case "COURSE":
      eventTypePrefix = "COURSE_CREATED";
      break;
    case "UPLOAD":
      eventTypePrefix = "FILE_UPLOADED";
      break;
    case "STORAGE":
      eventTypePrefix = "STORAGE_USED";
      break;
    case "GENERATION":
      eventTypePrefix = "GENERATED"; 
      break;
    case "CHAT":
      eventTypePrefix = "CHAT_MESSAGE_SENT";
      break;
  }

  let usageCount = 0;
  if (type === "COURSE") {
    usageCount = await prisma.course.count({
      where: { userId },
    });
  } else if (type === "STORAGE") {
    const files = await prisma.file.aggregate({
      where: { course: { userId } },
      _sum: { fileSize: true },
    });
    usageCount = files._sum.fileSize || 0;
  } else {
    const events = await prisma.usageEvent.aggregate({
      where: {
        userId,
        billingPeriod,
        eventType: {
          contains: eventTypePrefix,
        },
      },
      _sum: {
        quantity: true,
      },
    });
    usageCount = events._sum.quantity || 0;
  }

  await cacheService.set(cacheKey, usageCount, 300);
  return usageCount;
}

export async function assertUsageAllowed(input: {
  userId: string;
  type: LimitType;
  requestedQuantity: number;
}) {
  const plan = await loadEffectivePlan(input.userId);
  
  // To get the true billing period, we might need the subscription start date
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      subscriptions: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const sub = user?.subscriptions[0];
  
  const billingPeriod = getCurrentBillingPeriod(sub?.currentPeriodStart);

  const used = await calculateUsage({
    userId: input.userId,
    type: input.type,
    billingPeriod,
  });

  const limit = getPlanLimit(plan, input.type);

  if (used + input.requestedQuantity > limit) {
    throw new UsageLimitError(input.type);
  }

  return {
    plan,
    billingPeriod,
    used,
    limit,
  };
}

