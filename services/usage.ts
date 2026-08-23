import { prisma } from "@/lib/prisma";
import { expireSubscriptionIfDue } from "@/services/subscription";

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

/**
 * Gets the current UTC year and month as the billing period for free users,
 * or the active subscription's billing period if applicable.
 */
export function getCurrentBillingPeriod(subscriptionStart?: Date | null): string {
  const date = subscriptionStart ? new Date(subscriptionStart) : new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function loadEffectivePlan(userId: string) {
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
      return activeSubscription.plan;
    }
  }

  // Prefer the FREE plan record from the database when one has been seeded.
  const freePlan = await prisma.plan.findFirst({
    where: { name: "FREE", active: true },
  });

  if (freePlan) {
    return freePlan;
  }

  // Fallback to Free plan limits
  return DEFAULT_FREE_PLAN;
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
      // For GENERATION we might have STUDY_NOTES_GENERATED, FLASHCARDS_GENERATED
      eventTypePrefix = "GENERATED"; 
      break;
    case "CHAT":
      eventTypePrefix = "CHAT_MESSAGE_SENT";
      break;
  }

  // For COURSE and STORAGE, limits are absolute (not per billing period usually, but let's 
  // assume COURSE is absolute and we can just count the active courses for courses.
  // The skill asks us to use UsageEvents or authoritative resource counts.)
  if (type === "COURSE") {
    // Authoritative resource count is better for absolute limits like courses
    const count = await prisma.course.count({
      where: { userId },
    });
    return count;
  }

  if (type === "STORAGE") {
    // Authoritative resource sum
    const files = await prisma.file.aggregate({
      where: { course: { userId } },
      _sum: { fileSize: true },
    });
    return files._sum.fileSize || 0;
  }

  // For other period-based limits, query usage events
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

  return events._sum.quantity || 0;
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
