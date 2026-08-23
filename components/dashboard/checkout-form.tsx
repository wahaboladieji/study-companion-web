"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyMinor } from "@/lib/money";
import {
  createCheckoutAction,
  verifyPaymentAction,
} from "@/app/actions/billing";
import type { CheckoutPlan } from "@/services/plans";
import { cn } from "@/lib/utils";

type CheckoutFormProps = {
  plan: CheckoutPlan | null;
  initialInterval: "monthly" | "yearly";
  txRef: string | null;
  returnStatus: string | null;
};

type VerifyState = "idle" | "verifying" | "success" | "error";

const RETURNABLE_STATUSES = ["successful", "completed", "cancelled", "failed"];

export function CheckoutForm({
  plan,
  initialInterval,
  txRef,
  returnStatus,
}: CheckoutFormProps) {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">(
    initialInterval
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [verifyState, setVerifyState] = useState<VerifyState>(() =>
    txRef && (returnStatus === "successful" || returnStatus === "completed")
      ? "verifying"
      : "idle"
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => {
        if (active) setCsrfToken(data.csrfToken ?? null);
      })
      .catch(() => {
        if (active) setCsrfToken(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (verifyState !== "verifying" || !csrfToken || !txRef) {
      return;
    }
    let active = true;
    verifyPaymentAction({ txRef, csrfToken })
      .then((result) => {
        if (!active) {
          return;
        }
        if (result.success) {
          setVerifyState("success");
        } else {
          setVerifyError(result.error ?? "Payment verification failed.");
          setVerifyState("error");
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setVerifyError("Something went wrong. Please try again.");
        setVerifyState("error");
      });
    return () => {
      active = false;
    };
  }, [verifyState, csrfToken, txRef]);

  const handleSubmit = () => {
    if (!plan || !csrfToken) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("csrfToken", csrfToken);
      formData.set("planId", plan.id);
      formData.set("interval", interval);
      const result = await createCheckoutAction(null, formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  if (verifyState === "success") {
    return (
      <div className="mx-auto mt-[var(--spacing-600)] w-full max-w-lg rounded-xl border border-surface-container-high bg-surface-lowest p-[var(--spacing-500)] text-center shadow-medium">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-container text-on-success-container">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-[var(--spacing-200)] text-title-large font-semibold text-on-surface">
          You are now on Premium
        </h1>
        <p className="mt-[var(--spacing-50)] text-body-medium text-on-surface-variant">
          Your subscription is active. Enjoy higher limits and priority processing.
        </p>
        <Button type="button" className="mt-[var(--spacing-300)]" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  if (verifyState === "verifying") {
    return (
      <div
        className="mx-auto mt-[var(--spacing-600)] w-full max-w-lg rounded-xl border border-surface-container-high bg-surface-lowest p-[var(--spacing-500)] text-center shadow-medium"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="mt-[var(--spacing-200)] text-body-medium text-on-surface">
          Verifying your payment...
        </p>
        <p className="mt-[var(--spacing-50)] text-body-small text-on-surface-variant">
          This usually takes a few seconds. Please keep this page open.
        </p>
      </div>
    );
  }

  if (
    verifyState === "error" ||
    (txRef && returnStatus && !RETURNABLE_STATUSES.includes(returnStatus))
  ) {
    return (
      <div className="mx-auto mt-[var(--spacing-600)] w-full max-w-lg rounded-xl border border-surface-container-high bg-surface-lowest p-[var(--spacing-500)] text-center shadow-medium">
        <h1 className="text-title-large font-semibold text-on-surface">
          Payment could not be verified
        </h1>
        <p className="mt-[var(--spacing-50)] text-body-medium text-on-surface-variant">
          {verifyError ??
            "The payment returned an unexpected status. If you were charged, contact support."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-[var(--spacing-300)]"
          onClick={() => router.push("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (returnStatus === "cancelled" || returnStatus === "failed") {
    return (
      <div className="mx-auto mt-[var(--spacing-600)] w-full max-w-lg rounded-xl border border-surface-container-high bg-surface-lowest p-[var(--spacing-500)] text-center shadow-medium">
        <h1 className="text-title-large font-semibold text-on-surface">
          Payment {returnStatus === "cancelled" ? "cancelled" : "did not complete"}
        </h1>
        <p className="mt-[var(--spacing-50)] text-body-medium text-on-surface-variant">
          No charge was made. You can try again whenever you are ready.
        </p>
        <div className="mt-[var(--spacing-300)] flex items-center justify-center gap-[var(--spacing-200)]">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </Button>
          <Button type="button" onClick={() => router.replace("/dashboard/billing")}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div
        className="mx-auto mt-[var(--spacing-600)] w-full max-w-lg rounded-xl border border-surface-container-high bg-surface-lowest p-[var(--spacing-500)] text-center shadow-medium"
        role="status"
      >
        <h1 className="text-title-large font-semibold text-on-surface">
          Checkout
        </h1>
        <p className="mt-[var(--spacing-50)] text-body-medium text-on-surface-variant">
          No plans are available yet. Please check back soon.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-[var(--spacing-300)]"
          onClick={() => router.push("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const yearlyAvailable = plan.yearlyPriceMinor !== null;

  return (
    <div className="mx-auto mt-[var(--spacing-400)] w-full max-w-lg">
      <button
        type="button"
        className="mb-[var(--spacing-300)] inline-flex items-center gap-[var(--spacing-75)] rounded-md text-label-medium text-on-surface-variant hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => router.push("/dashboard")}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </button>

      <div className="rounded-xl border border-surface-container-high bg-surface-lowest shadow-medium">
        <div className="border-b border-surface-container-low p-[var(--spacing-400)]">
          <h1 className="text-title-large font-semibold text-on-surface">Checkout</h1>
          <p className="mt-[var(--spacing-25)] text-body-small text-on-surface-variant">
            Review your plan and choose a billing period to continue.
          </p>
        </div>

        <div className="space-y-[var(--spacing-300)] p-[var(--spacing-400)]">
          <div className="flex items-center gap-[var(--spacing-150)] rounded-lg bg-primary-container-light p-[var(--spacing-200)]">
            <Sparkles className="h-5 w-5 shrink-0 text-on-primary-container" aria-hidden="true" />
            <div>
              <p className="text-label-medium font-semibold text-on-primary-container">
                {plan.name} plan
              </p>
              <p className="text-body-small text-on-primary-container">
                {plan.courseLimit} courses &middot; {plan.uploadLimit} uploads per course &middot;{" "}
                {plan.aiGenerationLimit} AI generations per month &middot; {plan.chatMessageLimit}{" "}
                chat messages per month &middot; {plan.storageLabel} storage
              </p>
            </div>
          </div>

          <div className="grid gap-[var(--spacing-200)] sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              aria-pressed={interval === "monthly"}
              className={cn(
                "rounded-lg border p-[var(--spacing-300)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                interval === "monthly"
                  ? "border-primary bg-surface"
                  : "border-surface-container-high bg-surface hover:border-outline"
              )}
            >
              <p className="text-label-large font-semibold text-on-surface">
                {formatMoneyMinor(plan.monthlyPriceMinor, plan.currency)}
              </p>
              <p className="text-body-small text-on-surface-variant">per month, billed monthly</p>
            </button>

            <button
              type="button"
              onClick={() => yearlyAvailable && setInterval("yearly")}
              disabled={!yearlyAvailable}
              aria-pressed={interval === "yearly"}
              className={cn(
                "rounded-lg border p-[var(--spacing-300)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
                interval === "yearly"
                  ? "border-primary bg-surface"
                  : "border-surface-container-high bg-surface hover:border-outline"
              )}
            >
              <p className="text-label-large font-semibold text-on-surface">
                {formatMoneyMinor(plan.yearlyPriceMinor ?? 0, plan.currency)}
              </p>
              <p className="text-body-small text-on-surface-variant">
                per year, billed annually
                {yearlyAvailable && " \u00B7 save with yearly"}
              </p>
            </button>
          </div>

          {error && (
            <div
              className="rounded-md bg-error-container p-[var(--spacing-200)] text-body-medium text-on-error-container"
              role="alert"
            >
              {error}
            </div>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={!csrfToken || isPending}
            onClick={handleSubmit}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Starting payment...
              </>
            ) : (
              `Proceed to Payment \u2014 ${formatMoneyMinor(
                interval === "yearly"
                  ? (plan.yearlyPriceMinor ?? plan.monthlyPriceMinor)
                  : plan.monthlyPriceMinor,
                plan.currency
              )}`
            )}
          </Button>

          <p className="text-center text-body-small text-on-surface-variant">
            You will be redirected to Flutterwave&apos;s secure checkout to complete your payment.
          </p>
        </div>
      </div>
    </div>
  );
}
