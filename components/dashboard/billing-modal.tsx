"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, X, CalendarCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyMinor } from "@/lib/money";
import { PlanCard } from "@/components/dashboard/plan-card";
import {
  cancelSubscriptionAction,
  clearScheduledChangeAction,
  createCheckoutAction,
  getBillingOverviewAction,
  resumeSubscriptionAction,
  scheduleCheckoutAction,
} from "@/app/actions/billing";
import type { BillingOverview } from "@/services/billing";

function InfoRow({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[var(--spacing-200)] border-t border-surface-container-low px-[var(--spacing-300)] py-[var(--spacing-150)] first:border-t-0">
      <span className="text-body-small text-outline">{label}</span>
      <div className="flex items-center gap-[var(--spacing-200)]">
        <span className="text-body-small font-semibold text-on-surface">{value}</span>
        {action}
      </div>
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
  
  const [isCheckoutPending, setIsCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [pendingSchedulePlan, setPendingSchedulePlan] = useState<{
    planId: string;
    interval: "monthly" | "yearly";
  } | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isClearingScheduled, setIsClearingScheduled] = useState(false);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!statusBanner) return;
    const timer = setTimeout(() => {
      setStatusBanner(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [statusBanner]);

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
      if (e.key === "Escape") {
        if (pendingSchedulePlan) {
          setPendingSchedulePlan(null);
        } else {
          onOpenChange(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, pendingSchedulePlan]);

  const premium = overview?.plans.premium ?? null;
  const isPremium = overview?.subscription != null;
  const currentInterval = overview?.subscription?.interval ?? null;
  const subscription = overview?.subscription ?? null;
  const cancelDateText = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : "the end of your billing period";

  const monthlyPrice = premium?.monthlyPriceMinor ?? 0;
  const yearlyPrice = premium?.yearlyPriceMinor ?? 0;
  let savePercentage = 0;
  if (monthlyPrice > 0 && yearlyPrice > 0) {
    savePercentage = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
  }
  const badgeText = savePercentage > 0 ? `Save ${savePercentage}%` : "Best value";

  const getPlanAction = (
    interval: "monthly" | "yearly"
  ): "upgrade" | "downgrade" | null => {
    if (!isPremium) return "upgrade";
    if (currentInterval === interval) return null;
    if (currentInterval === "monthly" && interval === "yearly") return "upgrade";
    if (currentInterval === "yearly" && interval === "monthly") return "downgrade";
    return null;
  };

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

  const handlePlanSelection = (interval: "monthly" | "yearly") => {
    if (!premium || !csrfToken) return;

    if (isPremium) {
      setPendingSchedulePlan({ planId: premium.id, interval });
      setCheckoutError(null);
      return;
    }

    goToCheckout(interval);
  };

  const goToCheckout = async (interval: "monthly" | "yearly") => {
    if (!premium || !csrfToken) return;
    setIsCheckoutPending(true);
    setCheckoutError(null);

    const formData = new FormData();
    formData.set("csrfToken", csrfToken);
    formData.set("planId", premium.id);
    formData.set("interval", interval);

    try {
      const result = await createCheckoutAction(null, formData);
      if (result?.error) {
        setCheckoutError(result.error);
        setIsCheckoutPending(false);
      } else if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setCheckoutError("Something went wrong. Please try again.");
        setIsCheckoutPending(false);
      }
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
      setIsCheckoutPending(false);
    }
  };

  const confirmSchedulePlan = async () => {
    if (!pendingSchedulePlan || !csrfToken) return;
    setIsScheduling(true);
    setCheckoutError(null);
    const targetIntervalLabel = pendingSchedulePlan.interval === "yearly" ? "Yearly" : "Monthly";
    const scheduledDateStr = formatDate(subscription?.currentPeriodEnd ?? null);

    try {
      const result = await scheduleCheckoutAction({
        planId: pendingSchedulePlan.planId,
        interval: pendingSchedulePlan.interval,
        csrfToken,
      });
      if (result.success) {
        setPendingSchedulePlan(null);
        await loadData();
        setStatusBanner(
          `You have successfully scheduled your new plan (${premiumName} ${targetIntervalLabel}) for activation on ${scheduledDateStr}.`
        );
        router.refresh();
      } else {
        setCheckoutError(result.error ?? "Failed to schedule plan change.");
      }
    } catch {
      setCheckoutError("Something went wrong while scheduling plan.");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleClearScheduled = async () => {
    if (!csrfToken) return;
    setIsClearingScheduled(true);
    setCancelError(null);
    try {
      const result = await clearScheduledChangeAction({ csrfToken });
      if (result.success) {
        await loadData();
        setStatusBanner("You have successfully removed your scheduled plan change.");
        router.refresh();
      } else {
        setCancelError(result.error ?? "Could not clear scheduled plan.");
      }
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setIsClearingScheduled(false);
    }
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
        setStatusBanner(
          `You have successfully canceled your subscription. You maintain full access until ${cancelDateText}.`
        );
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
        setStatusBanner("You have successfully restored your subscription auto-renewal.");
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
            className="fixed inset-0 bg-inverse-surface/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-modal-title"
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-surface-container-high bg-surface-lowest shadow-hard outline-none"
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
                  <p className="text-body-small text-outline">
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
                  {/* Status Banner */}
                  {statusBanner && (
                    <div
                      role="status"
                      className="mb-[var(--spacing-300)] flex items-center justify-between gap-[var(--spacing-200)] rounded-xl border border-primary/20 bg-primary/10 px-[var(--spacing-300)] py-[var(--spacing-200)] text-body-small text-on-surface shadow-sm animate-fade-in"
                    >
                      <div className="flex items-center gap-[var(--spacing-200)]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="font-medium text-on-surface">{statusBanner}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusBanner(null)}
                        className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-primary/20 hover:text-on-surface focus-visible:outline-none"
                        aria-label="Dismiss message"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

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
                        value={
                          isPremium ? (
                            subscription?.cancelAtPeriodEnd ? (
                              <span className="inline-flex items-center gap-[var(--spacing-75)]">
                                <span className="text-outline font-medium">Canceled</span>
                                <span className="text-outline-variant">·</span>
                                <span>{intervalText}</span>
                              </span>
                            ) : (
                              `Active · ${intervalText}`
                            )
                          ) : (
                            "—"
                          )
                        }
                        action={
                          isPremium && subscription?.cancelAtPeriodEnd ? (
                            <button
                              type="button"
                              className="text-label-small font-semibold text-primary transition-colors hover:underline disabled:opacity-50"
                              disabled={isResuming}
                              onClick={handleResume}
                            >
                              {isResuming ? "Resuming..." : "Resume"}
                            </button>
                          ) : undefined
                        }
                      />
                      <InfoRow
                        label="Access until"
                        value={
                          isPremium && subscription?.currentPeriodEnd
                            ? formatDate(subscription.currentPeriodEnd)
                            : "—"
                        }
                      />
                      {subscription?.scheduledPlanName && (
                        <InfoRow
                          label="Next plan"
                          value={`${subscription.scheduledPlanName} (${subscription.scheduledInterval === "yearly" ? "Yearly" : "Monthly"})`}
                          action={
                            <button
                              type="button"
                              className="text-label-small font-semibold text-error transition-colors hover:underline disabled:opacity-50"
                              disabled={isClearingScheduled}
                              onClick={handleClearScheduled}
                            >
                              {isClearingScheduled ? "Clearing..." : "Remove"}
                            </button>
                          }
                        />
                      )}
                    </div>

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
                        isLoading={isCheckoutPending}
                        action={getPlanAction("monthly")}
                        onAction={() => handlePlanSelection("monthly")}
                      />
                      <PlanCard
                        label="Yearly"
                        priceLabel={
                          premium.yearlyPriceMinor === null
                            ? null
                            : formatMoneyMinor(premium.yearlyPriceMinor, premium.currency)
                        }
                        perLabel="per year"
                        badge={premium.yearlyPriceMinor === null ? undefined : badgeText}
                        isCurrent={isPremium && currentInterval === "yearly"}
                        isLoading={isCheckoutPending}
                        action={
                          premium.yearlyPriceMinor === null ? null : getPlanAction("yearly")
                        }
                        onAction={() => handlePlanSelection("yearly")}
                      />
                    </div>
                  </section>

                  {/* Cancel subscription */}
                  {isPremium && !subscription?.cancelAtPeriodEnd && (
                    <section
                      aria-labelledby="billing-cancel-heading"
                      className="mt-[var(--spacing-400)] border-t border-surface-container-low pt-[var(--spacing-400)]"
                    >
                      {confirmCancel ? (
                        <div className="rounded-xl border border-surface-container-high bg-surface px-[var(--spacing-400)] py-[var(--spacing-300)] shadow-sm">
                          <div className="space-y-[var(--spacing-200)]">
                            <p className="text-label-large font-semibold text-on-surface">
                              Cancel your subscription?
                            </p>
                            <p className="text-body-small text-outline">
                              You&apos;ll keep Premium access until {cancelDateText}, then
                              revert to the Free plan. Your courses, files, notes, and chat
                              history are kept.
                            </p>
                            {cancelError && (
                              <p className="text-body-small text-error" role="alert">
                                {cancelError}
                              </p>
                            )}
                            <div className="flex flex-col gap-[var(--spacing-150)] pt-[var(--spacing-100)] sm:flex-row sm:justify-end">
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
                                variant="outline"
                                className="border-error text-error hover:bg-error/10 hover:text-error"
                                disabled={isCancelling}
                                onClick={handleCancel}
                              >
                                {isCancelling ? "Cancelling..." : "Yes, cancel plan"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-[var(--spacing-300)] sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3
                              id="billing-cancel-heading"
                              className="text-label-medium font-semibold text-on-surface"
                            >
                              Cancel subscription
                            </h3>
                            <p className="text-body-small text-outline">
                              Downgrade to the Free plan at the end of your billing cycle.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 text-error hover:bg-error-container/50 hover:text-error border-error-container"
                            onClick={() => setConfirmCancel(true)}
                          >
                            Cancel plan
                          </Button>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Stacked Pop-up Modal for Schedule Plan Confirmation ── */}
          {pendingSchedulePlan && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-[var(--spacing-400)]">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-xs"
                aria-hidden="true"
                onClick={() => setPendingSchedulePlan(null)}
              />

              {/* Modal Card */}
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="schedule-modal-title"
                className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-2xl border border-surface-container-high bg-surface-lowest shadow-hard outline-none"
              >
                {/* Accent bar */}
                <div className="h-[3px] w-full bg-primary" />

                {/* Header */}
                <div className="flex items-center justify-between px-[var(--spacing-400)] pt-[var(--spacing-300)] pb-[var(--spacing-200)]">
                  <div className="flex items-center gap-[var(--spacing-200)]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                      <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h3
                      id="schedule-modal-title"
                      className="text-title-small font-semibold text-on-surface"
                    >
                      Confirm Plan Schedule
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingSchedulePlan(null)}
                    className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                    aria-label="Close modal"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="border-t border-surface-container-low" />

                {/* Body */}
                <div className="p-[var(--spacing-400)] space-y-[var(--spacing-300)]">
                  {/* Compact info summary */}
                  <div className="rounded-xl border border-surface-container-high bg-surface-container-lowest p-[var(--spacing-250)] space-y-[var(--spacing-150)] text-body-small">
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Running plan:</span>
                      <span className="font-semibold text-on-surface">
                        {premiumName} ({intervalText})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Active until:</span>
                      <span className="font-medium text-on-surface">
                        {formatDate(subscription?.currentPeriodEnd ?? null)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-container-low pt-[var(--spacing-150)]">
                      <span className="text-outline">New scheduled plan:</span>
                      <span className="font-bold text-primary">
                        {premiumName} ({pendingSchedulePlan.interval === "yearly" ? "Yearly" : "Monthly"})
                      </span>
                    </div>
                  </div>

                  <p className="text-body-small text-outline leading-relaxed">
                    Your current plan stays active until {formatDate(subscription?.currentPeriodEnd ?? null)}. No double charge will occur today.
                  </p>

                  {checkoutError && (
                    <p className="text-body-small text-error" role="alert">
                      {checkoutError}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-[var(--spacing-200)] pt-[var(--spacing-100)]">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={isScheduling}
                      onClick={() => setPendingSchedulePlan(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="flex-1"
                      disabled={isScheduling}
                      onClick={confirmSchedulePlan}
                    >
                      {isScheduling ? "Scheduling..." : "Approve Schedule"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
