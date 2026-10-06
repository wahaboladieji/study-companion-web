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
    scheduledPlanId: string | null;
    scheduledInterval: string | null;
    scheduledPlanName: string | null;
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
        scheduledPlanId: true,
        scheduledInterval: true,
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

  let scheduledPlanName: string | null = null;
  if (subscription?.scheduledPlanId) {
    const sPlan = await prisma.plan.findUnique({
      where: { id: subscription.scheduledPlanId },
      select: { name: true },
    });
    scheduledPlanName = sPlan?.name ?? null;
  }

  return {
    plans,
    subscription: subscription
      ? {
          status: subscription.status,
          interval: inferSubscriptionInterval(subscription),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          scheduledPlanId: subscription.scheduledPlanId,
          scheduledInterval: subscription.scheduledInterval,
          scheduledPlanName,
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

export async function scheduleFutureSubscription(
  userId: string,
  planId: string,
  interval: string
): Promise<{ success: boolean; error?: string }> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      plan: { select: { name: true } },
    },
  });

  if (!subscription) {
    return {
      success: false,
      error: "You don't have an active subscription to modify.",
    };
  }

  const targetPlan = await prisma.plan.findUnique({
    where: { id: planId, active: true },
  });

  if (!targetPlan) {
    return {
      success: false,
      error: "The requested plan is not available.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        scheduledPlanId: targetPlan.id,
        scheduledInterval: interval,
      },
    });

    await tx.paymentLog.create({
      data: {
        userId,
        event: "SUBSCRIPTION_CHANGE_SCHEDULED",
        message: `User scheduled change to ${targetPlan.name} (${interval}) following current period end`,
      },
    });
  });

  return { success: true };
}

export async function clearScheduledSubscription(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true },
  });

  if (!subscription) {
    return {
      success: false,
      error: "You don't have an active subscription.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        scheduledPlanId: null,
        scheduledInterval: null,
      },
    });

    await tx.paymentLog.create({
      data: {
        userId,
        event: "SCHEDULED_SUBSCRIPTION_CLEARED",
        message: "User cleared scheduled subscription change",
      },
    });
  });

  return { success: true };
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
