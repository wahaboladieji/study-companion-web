import { prisma } from "@/lib/prisma";
import { cacheService } from "@/lib/cache/cache-service";

export type SubscriptionInterval = "monthly" | "yearly";

const YEARLY_THRESHOLD_DAYS = 300;

export async function invalidateUserSubscriptionCache(userId: string): Promise<void> {
  await cacheService.del(`sub:user:${userId}`);
}

export async function getActiveSubscription(userId: string) {
  const cacheKey = `sub:user:${userId}`;
  const cached = await cacheService.get<{
    id: string;
    userId: string;
    planId: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    scheduledPlanId: string | null;
    scheduledInterval: string | null;
    currentPeriodStart: string | Date | null;
    currentPeriodEnd: string | Date | null;
    plan: { id: string; name: string };
  }>(cacheKey);

  if (cached) {
    return {
      ...cached,
      currentPeriodStart: cached.currentPeriodStart ? new Date(cached.currentPeriodStart) : null,
      currentPeriodEnd: cached.currentPeriodEnd ? new Date(cached.currentPeriodEnd) : null,
    };
  }

  const sub = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      userId: true,
      planId: true,
      status: true,
      cancelAtPeriodEnd: true,
      scheduledPlanId: true,
      scheduledInterval: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      plan: {
        select: { id: true, name: true },
      },
    },
  });

  if (sub) {
    await cacheService.set(cacheKey, sub, 600); // 10 minutes TTL
  }

  return sub;
}

export function inferSubscriptionInterval(subscription: {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} | null): SubscriptionInterval | null {
  if (!subscription?.currentPeriodStart || !subscription?.currentPeriodEnd) {
    return null;
  }
  const durationDays =
    (subscription.currentPeriodEnd.getTime() -
      subscription.currentPeriodStart.getTime()) /
    (1000 * 60 * 60 * 24);
  return durationDays >= YEARLY_THRESHOLD_DAYS ? "yearly" : "monthly";
}

export async function expireSubscriptionIfDue(subscription: {
  id: string;
  userId: string;
  status: string;
  currentPeriodEnd: Date | null;
  scheduledPlanId?: string | null;
  scheduledInterval?: string | null;
}): Promise<boolean> {
  if (subscription.status !== "ACTIVE") return false;
  if (!subscription.currentPeriodEnd) return false;
  if (subscription.currentPeriodEnd > new Date()) return false;

  await prisma.$transaction(async (tx) => {
    const fullSub = await tx.subscription.findUnique({
      where: { id: subscription.id },
      select: { scheduledPlanId: true, scheduledInterval: true },
    });

    const updated = await tx.subscription.updateMany({
      where: { id: subscription.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });

    if (updated.count === 0) {
      return;
    }

    const scheduledPlanId = fullSub?.scheduledPlanId ?? subscription.scheduledPlanId;
    const scheduledInterval = fullSub?.scheduledInterval ?? subscription.scheduledInterval;

    if (scheduledPlanId && (scheduledInterval === "monthly" || scheduledInterval === "yearly")) {
      const scheduledPlan = await tx.plan.findUnique({
        where: { id: scheduledPlanId, active: true },
      });

      if (scheduledPlan) {
        const periodStart = subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date() ? subscription.currentPeriodEnd : new Date();
        const periodEnd = new Date(periodStart);
        if (scheduledInterval === "yearly") {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        await tx.subscription.create({
          data: {
            userId: subscription.userId,
            planId: scheduledPlan.id,
            provider: "FLUTTERWAVE",
            status: "ACTIVE",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
        });

        await tx.user.update({
          where: { id: subscription.userId },
          data: { subscriptionTier: "PREMIUM" },
        });

        await tx.paymentLog.create({
          data: {
            userId: subscription.userId,
            event: "SCHEDULED_PLAN_ACTIVATED",
            message: `Scheduled ${scheduledPlan.name} (${scheduledInterval}) plan activated following period end`,
          },
        });

        return;
      }
    }

    const otherActive = await tx.subscription.findFirst({
      where: {
        userId: subscription.userId,
        id: { not: subscription.id },
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!otherActive) {
      await tx.user.update({
        where: { id: subscription.userId },
        data: { subscriptionTier: "FREE" },
      });
    }

    await tx.paymentLog.create({
      data: {
        userId: subscription.userId,
        event: "SUBSCRIPTION_EXPIRED",
        message: "Subscription billing period ended; user reverted to FREE",
      },
    });
  });

  await invalidateUserSubscriptionCache(subscription.userId);
  return true;
}

