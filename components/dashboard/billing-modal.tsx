"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyMinor } from "@/lib/money";
import { PlanCard } from "@/components/dashboard/plan-card";
import {
  cancelSubscriptionAction,
  getBillingOverviewAction,
  resumeSubscriptionAction,
} from "@/app/actions/billing";
import type { BillingOverview } from "@/services/billing";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-[var(--spacing-200)] border-t border-surface-container-low px-[var(--spacing-300)] py-[var(--spacing-100)] first:border-t-0">
      <span className="text-body-small text-on-surface-variant">{label}</span>
      <span className="text-body-small font-semibold text-on-surface">{value}</span>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BillingModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setOverview(await getBillingOverviewAction());
    } catch {
      setLoadError("We couldn't load your billing details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let active = true;
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => {
        if (active) setCsrfToken(data.csrfToken ?? null);
      })
      .catch(() => {
        if (active) setCsrfToken(null);
      });

    getBillingOverviewAction()
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch(() => {
        if (active) setLoadError("We couldn't load your billing details. Please try again.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const premium = overview?.plans.premium ?? null;
  const isPremium = overview?.subscription != null;
  const currentInterval = overview?.subscription?.interval ?? null;
  const subscription = overview?.subscription ?? null;
  const cancelDateText = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : "the end of your billing period";

  const premiumName = premium
    ? premium.name.charAt(0).toUpperCase() + premium.name.slice(1).toLowerCase()
    : "Premium";
  const intervalText = currentInterval === "yearly" ? "Yearly" : "Monthly";
  const aiGenerationRow = premium?.benefits.find(
    (benefit) => benefit.label === "AI generations per month"
  );
  const creditsText = `${
    isPremium ? aiGenerationRow?.premiumValue : aiGenerationRow?.freeValue ?? "—"
  } AI generations / month`;

  const getPlanAction = (
    interval: "monthly" | "yearly"
  ): "upgrade" | "downgrade" | null => {
    if (!isPremium) return "upgrade";
    if (currentInterval === interval) return null;
    if (currentInterval === "monthly" && interval === "yearly") return "upgrade";
    if (currentInterval === "yearly" && interval === "monthly") return "downgrade";
    return null;
  };

  const goToCheckout = (interval: "monthly" | "yearly") => {
    if (!premium) return;
    onOpenChange(false);
    router.push(
      `/dashboard/billing?planId=${encodeURIComponent(premium.id)}&interval=${interval}`
    );
  };

  const handleCancel = async () => {
    if (!csrfToken) {
      setCancelError("Security check failed. Please refresh the page and try again.");
      return;
    }
    setIsCancelling(true);
    setCancelError(null);
    try {
      const result = await cancelSubscriptionAction({ csrfToken });
      if (result.success) {
        setConfirmCancel(false);
        await loadData();
        router.refresh();
      } else {
        setCancelError(result.error ?? "We could not cancel your subscription. Please try again.");
      }
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleResume = async () => {
    if (!csrfToken) {
      setCancelError("Security check failed. Please refresh the page and try again.");
      return;
    }
    setIsResuming(true);
    setCancelError(null);
    try {
      const result = await resumeSubscriptionAction({ csrfToken });
      if (!result.success) {
        setCancelError(result.error ?? "We could not resume your subscription. Please try again.");
      } else {
        await loadData();
        router.refresh();
      }
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 animate-backdrop-fade-in bg-inverse-surface/80 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-modal-title"
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[480px] animate-modal-scale-in -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-surface-container-high bg-surface-lowest shadow-hard outline-none"
          >
            <div className="h-[3px] w-full bg-primary" />

            {/* Header */}
            <div className="flex items-center justify-between px-[var(--spacing-500)] pt-[var(--spacing-300)] pb-[var(--spacing-300)]">
              <div className="flex items-center gap-[var(--spacing-300)]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <CreditCard className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="billing-modal-title"
                    className="text-title-medium font-semibold text-on-surface"
                  >
                    Billing
                  </h2>
                  <p className="text-body-small text-on-surface-variant">
                    Manage your plan and payments
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="rounded-full p-[var(--spacing-100)] text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-surface-container-low" />

            {/* Body */}
            <div className="flex-1 space-y-[var(--spacing-400)] overflow-y-auto px-[var(--spacing-500)] pt-[var(--spacing-300)] pb-[var(--spacing-400)]">
              {isLoading && !overview ? (
                <div className="flex items-center justify-center py-[var(--spacing-600)]" role="status">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                  <span className="sr-only">Loading billing details</span>
                </div>
              ) : loadError ? (
                <div className="space-y-[var(--spacing-200)]">
                  <div
                    className="rounded-md bg-error-container p-[var(--spacing-200)] text-body-medium text-on-error-container"
                    role="alert"
                  >
                    {loadError}
                  </div>
                  <Button type="button" variant="outline" onClick={loadData}>
                    Try again
                  </Button>
                </div>
              ) : !overview ? (
                <p className="rounded-xl border border-surface-container-high bg-surface px-[var(--spacing-400)] py-[var(--spacing-300)] text-body-small text-on-surface-variant">
                  Billing details are unavailable right now.
                </p>
              ) : !premium ? (
                <p
                  className="rounded-xl border border-surface-container-high bg-surface px-[var(--spacing-400)] py-[var(--spacing-300)] text-body-small text-on-surface-variant"
                  role="status"
                >
                  Premium plans are being set up. Please check back soon.
                </p>
              ) : (
                <>
                  {/* Current plan */}
                  <section
                    aria-labelledby="billing-current-plan-heading"
                    className="space-y-[var(--spacing-150)]"
                  >
                    <h3
                      id="billing-current-plan-heading"
                      className="text-label-medium font-semibold text-on-surface-variant"
                    >
                      Current plan
                    </h3>

                    <div className="overflow-hidden rounded-xl border border-surface-container-high">
                      <InfoRow
                        label="Current plan"
                        value={isPremium ? premiumName : "Free"}
                      />
                      <InfoRow label="Credits" value={creditsText} />
                      <InfoRow
                        label="Subscription"
                        value={isPremium ? `Active · ${intervalText}` : "—"}
                      />
                      <InfoRow
                        label="Renewal date"
                        value={
                          isPremium && subscription?.currentPeriodEnd
                            ? formatDate(subscription.currentPeriodEnd)
                            : "—"
                        }
                      />
                    </div>

                    {isPremium && subscription?.cancelAtPeriodEnd && (
                      <div className="flex flex-wrap items-center justify-between gap-[var(--spacing-150)] rounded-lg border border-surface-container-high bg-surface px-[var(--spacing-300)] py-[var(--spacing-200)]">
                        <p className="min-w-0 text-body-small text-on-surface-variant">
                          Your plan stays active until{" "}
                          {formatDate(subscription.currentPeriodEnd)}, then it cancels.
                          You&apos;ll keep Premium access until then.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={isResuming}
                          onClick={handleResume}
                        >
                          {isResuming ? "Resuming..." : "Resume"}
                        </Button>
                      </div>
                    )}
                    {cancelError && (
                      <p className="text-body-small text-error" role="alert">
                        {cancelError}
                      </p>
                    )}
                  </section>

                  {/* Manage billing period */}
                  <section
                    aria-labelledby="billing-manage-heading"
                    className="space-y-[var(--spacing-150)]"
                  >
                    <h3
                      id="billing-manage-heading"
                      className="text-label-medium font-semibold text-on-surface-variant"
                    >
                      {isPremium ? "Change billing period" : "Upgrade to Premium"}
                    </h3>
                    <div className="grid grid-cols-2 gap-[var(--spacing-200)]">
                      <PlanCard
                        label="Monthly"
                        priceLabel={formatMoneyMinor(premium.monthlyPriceMinor, premium.currency)}
                        perLabel="per month"
                        isCurrent={isPremium && currentInterval === "monthly"}
                        action={getPlanAction("monthly")}
                        onAction={() => goToCheckout("monthly")}
                      />
                      <PlanCard
                        label="Yearly"
                        priceLabel={
                          premium.yearlyPriceMinor === null
                            ? null
                            : formatMoneyMinor(premium.yearlyPriceMinor, premium.currency)
                        }
                        perLabel="per year"
                        badge={premium.yearlyPriceMinor === null ? undefined : "Best value"}
                        isCurrent={isPremium && currentInterval === "yearly"}
                        action={
                          premium.yearlyPriceMinor === null ? null : getPlanAction("yearly")
                        }
                        onAction={() => goToCheckout("yearly")}
                      />
                    </div>
                  </section>

                  {/* Cancel subscription */}
                  {isPremium && !subscription?.cancelAtPeriodEnd && (
                    <section
                      aria-labelledby="billing-cancel-heading"
                      className="space-y-[var(--spacing-150)]"
                    >
                      <h3
                        id="billing-cancel-heading"
                        className="text-label-medium font-semibold text-on-surface-variant"
                      >
                        Subscription
                      </h3>
                      <div className="rounded-xl border border-error-container bg-error-container p-[var(--spacing-300)]">
                        {confirmCancel ? (
                          <div className="space-y-[var(--spacing-200)]">
                            <p className="text-label-large font-semibold text-on-error-container">
                              Cancel your subscription?
                            </p>
                            <p className="text-body-small text-on-error-container">
                              You&apos;ll keep Premium access until {cancelDateText}, then
                              revert to the Free plan. Your courses, files, notes, and chat
                              history are kept.
                            </p>
                            {cancelError && (
                              <p className="text-body-small text-error" role="alert">
                                {cancelError}
                              </p>
                            )}
                            <div className="flex flex-col gap-[var(--spacing-100)] sm:flex-row sm:justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={isCancelling}
                                onClick={() => {
                                  setConfirmCancel(false);
                                  setCancelError(null);
                                }}
                              >
                                Keep my plan
                              </Button>
                              <Button
                                type="button"
                                className="bg-error text-on-error hover:opacity-90"
                                disabled={isCancelling}
                                onClick={handleCancel}
                              >
                                {isCancelling ? "Cancelling..." : "Yes, cancel plan"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-[var(--spacing-150)]">
                            <div className="flex items-start gap-[var(--spacing-150)]">
                              <AlertTriangle
                                className="mt-0.5 h-5 w-5 shrink-0 text-on-error-container"
                                aria-hidden="true"
                              />
                              <div>
                                <p className="text-label-large font-semibold text-on-error-container">
                                  Cancel subscription
                                </p>
                                <p className="mt-[var(--spacing-25)] text-body-small text-on-error-container">
                                  Your plan stays active until {cancelDateText}, then you&apos;ll
                                  revert to the Free plan. Your study data is kept.
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => setConfirmCancel(true)}
                            >
                              Cancel subscription
                            </Button>
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
