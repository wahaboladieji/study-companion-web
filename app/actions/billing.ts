"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/services/auth";
import { validateCsrfToken } from "@/services/csrf";
import { getActivePlanById } from "@/services/plans";
import {
  getBillingOverview,
  cancelSubscription,
  resumeSubscription,
  type BillingOverview,
} from "@/services/billing";
import {
  createTransactionReference,
  getAppBaseUrl,
  initializeCheckout,
  isFlutterwaveConfigured,
  FlutterwaveNotConfiguredError,
  verifyTransaction,
} from "@/services/flutterwave";

export type CheckoutFormState = {
  error?: string;
  checkoutUrl?: string;
} | null;

export type VerifyPaymentResult = {
  success: boolean;
  error?: string;
};

const CSRF_FAILURE = "Security check failed. Please refresh the page and try again.";
const AUTH_FAILURE = "You must be signed in to upgrade your plan.";
const PLAN_FAILURE = "This plan is no longer available. Please try again.";
const PAYMENTS_UNAVAILABLE =
  "Payments are not available yet. Please try again later.";

function revalidateDashboardCache() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/billing", "page");
}

export async function createCheckoutAction(
  prevState: CheckoutFormState,
  formData: FormData
): Promise<CheckoutFormState> {
  if (!(await validateCsrfToken(formData.get("csrfToken") as string | null))) {
    return { error: CSRF_FAILURE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: AUTH_FAILURE };
  }

  const planId = formData.get("planId");
  const interval = formData.get("interval");
  if (
    typeof planId !== "string" ||
    (interval !== "monthly" && interval !== "yearly")
  ) {
    return { error: PLAN_FAILURE };
  }

  const plan = await getActivePlanById(planId);
  if (!plan) {
    return { error: PLAN_FAILURE };
  }

  const amountMinor =
    interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  if (amountMinor === null || amountMinor <= 0) {
    return { error: PLAN_FAILURE };
  }

  if (!isFlutterwaveConfigured()) {
    return { error: PAYMENTS_UNAVAILABLE };
  }

  const reference = createTransactionReference();

  try {
    await prisma.$transaction(async (tx) => {
      const pTx = await tx.paymentTransaction.create({
        data: {
          userId: user.id,
          planId: plan.id,
          amountMinor,
          currency: plan.currency,
          interval,
          provider: "FLUTTERWAVE",
          providerReference: reference,
          status: "PENDING",
        },
      });
      await tx.paymentLog.create({
        data: {
          userId: user.id,
          transactionId: pTx.id,
          event: "CHECKOUT_INITIALIZED",
          message: `Started checkout for ${plan.name} (${interval})`,
        },
      });
    });

    const redirectUrl = `${await getAppBaseUrl()}/dashboard/billing?planId=${plan.id}&interval=${interval}`;
    const checkout = await initializeCheckout({
      txRef: reference,
      amountMinor,
      currency: plan.currency,
      customerEmail: user.email,
      customerName: user.name,
      redirectUrl,
    });

    return { checkoutUrl: checkout.checkoutUrl };
  } catch (error) {
    console.error("Checkout Initialization Error:", error);
    if (error instanceof FlutterwaveNotConfiguredError) {
      return { error: PAYMENTS_UNAVAILABLE };
    }
    return { error: "We could not start the payment. Please try again." };
  }
}

export async function verifyPaymentAction(
  input: { txRef: string; csrfToken: string }
): Promise<VerifyPaymentResult> {
  if (!(await validateCsrfToken(input.csrfToken))) {
    return { success: false, error: CSRF_FAILURE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: AUTH_FAILURE };
  }

  if (!isFlutterwaveConfigured()) {
    return {
      success: false,
      error: "Payment verification is not available yet. Please try again later.",
    };
  }

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { providerReference: input.txRef },
  });

  if (!transaction) {
    return { success: false, error: "Payment not found. Please contact support." };
  }

  await prisma.paymentLog.create({
    data: {
      userId: user.id,
      transactionId: transaction.id,
      event: "FRONTEND_VERIFICATION_ATTEMPT",
      message: "User returned from Flutterwave, attempting verification",
    },
  });

  if (transaction.status === "SUCCESSFUL") {
    revalidateDashboardCache();
    return { success: true };
  }

  let verified;
  try {
    verified = await verifyTransaction(input.txRef);
  } catch {
    return {
      success: false,
      error: "We could not verify the payment. Please try again.",
    };
  }

  if (verified.status !== "successful") {
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: "FAILED" },
    });
    return {
      success: false,
      error: "The payment did not complete. Please try again.",
    };
  }

  if (
    verified.amountMinor !== transaction.amountMinor ||
    verified.currency !== transaction.currency
  ) {
    return {
      success: false,
      error: "The payment details did not match. Please contact support.",
    };
  }

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  if (transaction.interval === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.paymentTransaction.findUnique({
        where: { providerReference: input.txRef },
      });
      if (existing?.status === "SUCCESSFUL") {
        return;
      }

      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "SUCCESSFUL",
          providerTransactionId: verified.transactionId,
        },
      });

      await tx.subscription.updateMany({
        where: { userId: transaction.userId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      await tx.subscription.create({
        data: {
          userId: transaction.userId,
          planId: transaction.planId,
          provider: "FLUTTERWAVE",
          status: "ACTIVE",
          providerSubscriptionId: verified.transactionId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });

      await tx.user.update({
        where: { id: transaction.userId },
        data: { subscriptionTier: "PREMIUM" },
      });
    });
  } catch {
    return {
      success: false,
      error: "We could not activate your subscription. Please contact support.",
    };
  }

  revalidateDashboardCache();
  return { success: true };
}

export async function getBillingOverviewAction(): Promise<BillingOverview> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      plans: { free: { name: "FREE" }, premium: null },
      subscription: null,
      transactions: [],
    };
  }

  const overview = await getBillingOverview(user.id);
  revalidateDashboardCache();
  return overview;
}

export type CancelSubscriptionResult = {
  success: boolean;
  error?: string;
};

export async function cancelSubscriptionAction(input: {
  csrfToken: string;
}): Promise<CancelSubscriptionResult> {
  if (!(await validateCsrfToken(input.csrfToken))) {
    return { success: false, error: CSRF_FAILURE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: AUTH_FAILURE };
  }

  const result = await cancelSubscription(user.id);
  if (!result.success) {
    return result;
  }

  revalidateDashboardCache();
  return { success: true };
}

export type ResumeSubscriptionResult = {
  success: boolean;
  error?: string;
};

export async function resumeSubscriptionAction(input: {
  csrfToken: string;
}): Promise<ResumeSubscriptionResult> {
  if (!(await validateCsrfToken(input.csrfToken))) {
    return { success: false, error: CSRF_FAILURE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: AUTH_FAILURE };
  }

  const result = await resumeSubscription(user.id);
  if (!result.success) {
    return result;
  }

  revalidateDashboardCache();
  return { success: true };
}
