"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyPaymentAction } from "@/app/actions/billing";

type CheckoutFormProps = {
  txRef: string;
  returnStatus: string | null;
};

type VerifyState = "idle" | "verifying" | "success" | "error";

const RETURNABLE_STATUSES = ["successful", "completed", "cancelled", "failed"];

export function CheckoutForm({
  txRef,
  returnStatus,
}: CheckoutFormProps) {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>(() =>
    returnStatus === "successful" || returnStatus === "completed"
      ? "verifying"
      : "error"
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
        </div>
      </div>
    );
  }

  // verifyState === "error"
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
