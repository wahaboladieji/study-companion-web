import { prisma } from "@/lib/prisma";
import { getUpgradeDialogData, type UpgradeDialogData } from "@/services/plans";
import {
  inferSubscriptionInterval,
  expireSubscriptionIfDue,
  type SubscriptionInterval,
} from "@/services/subscription";

export type BillingTransaction = {
  id: string;
  planName: string;
  amountMinor: number;
  currency: string;
  interval: string;
  status: string;
  createdAt: string;
};

export type BillingOverview = {
  plans: UpgradeDialogData;
  subscription: {
    status: string;
    interval: SubscriptionInterval | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  transactions: BillingTransaction[];
};

export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  const [plans, activeSubscription, transactions] = await Promise.all([
    getUpgradeDialogData(),
    prisma.subscription.findFirst({
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
    }),
    prisma.paymentTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amountMinor: true,
        currency: true,
        interval: true,
        status: true,
        createdAt: true,
        plan: { select: { name: true } },
      },
    }),
  ]);

  let subscription = activeSubscription;
  if (subscription) {
    const expired = await expireSubscriptionIfDue(subscription);
    if (expired) {
      subscription = null;
    }
  }

  return {
    plans,
    subscription: subscription
      ? {
          status: subscription.status,
          interval: inferSubscriptionInterval(subscription),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    transactions: transactions.map((tx) => ({
      id: tx.id,
      planName: tx.plan.name,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
      interval: tx.interval,
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
    })),
  };
}

export async function cancelSubscription(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      cancelAtPeriodEnd: true,
      plan: { select: { name: true } },
    },
  });

  if (!subscription) {
    return {
      success: false,
      error: "You don't have an active subscription to cancel.",
    };
  }

  if (subscription.cancelAtPeriodEnd) {
    return { success: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true },
    });

    await tx.paymentLog.create({
      data: {
        userId,
        event: "SUBSCRIPTION_CANCEL_SCHEDULED",
        message: `User scheduled cancellation of their ${subscription.plan.name} subscription at the end of the billing period`,
      },
    });
  });

  return { success: true };
}

export async function resumeSubscription(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", cancelAtPeriodEnd: true },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, plan: { select: { name: true } } },
  });

  if (!subscription) {
    return {
      success: false,
      error: "You don't have a subscription scheduled to cancel.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false },
    });

    await tx.paymentLog.create({
      data: {
        userId,
        event: "SUBSCRIPTION_CANCEL_REVERSED",
        message: `User resumed their ${subscription.plan.name} subscription`,
      },
    });
  });

  return { success: true };
}
