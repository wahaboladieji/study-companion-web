import { prisma } from "@/lib/prisma";

export type SubscriptionInterval = "monthly" | "yearly";

const YEARLY_THRESHOLD_DAYS = 300;

export async function getActiveSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      userId: true,
      status: true,
      cancelAtPeriodEnd: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });
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
}): Promise<boolean> {
  if (subscription.status !== "ACTIVE") return false;
  if (!subscription.currentPeriodEnd) return false;
  if (subscription.currentPeriodEnd > new Date()) return false;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.updateMany({
      where: { id: subscription.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });

    if (updated.count === 0) {
      return;
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

  return true;
}
