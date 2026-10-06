"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyMinor } from "@/lib/money";
import { PlanCard } from "@/components/dashboard/plan-card";
import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import type { UpgradeDialogData } from "@/services/plans";
import type { SubscriptionInterval } from "@/services/subscription";
import { createCheckoutAction, scheduleCheckoutAction } from "@/app/actions/billing";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function UpgradeDialog({
  data,
  currentTier,
  currentInterval,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  triggerContent,
  triggerClassName,
  open,
  onOpenChange,
}: {
  data: UpgradeDialogData;
  currentTier?: string | null;
  currentInterval?: SubscriptionInterval | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isCheckoutPending, setIsCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [pendingSchedulePlan, setPendingSchedulePlan] = useState<{
    planId: string;
    interval: "monthly" | "yearly";
  } | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const setIsOpen = useCallback(
    (next: boolean) => {
      if (onOpenChange) {
        onOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [onOpenChange]
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    
    let active = true;
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => {
        if (active) setCsrfToken(data.csrfToken ?? null);
      })
      .catch(() => {
        if (active) setCsrfToken(null);
      });

    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const premium = data.premium;
  const normalizedTier = (currentTier ?? "FREE").trim().toUpperCase();
  const isPremiumCurrent =
    premium !== null && premium.name.toUpperCase() === normalizedTier;

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
    if (!isPremiumCurrent) return "upgrade";
    if (currentInterval === interval) return null;
    if (currentInterval === "monthly" && interval === "yearly") return "upgrade";
    if (currentInterval === "yearly" && interval === "monthly") return "downgrade";
    return null;
  };

  const handlePlanSelection = (interval: "monthly" | "yearly") => {
    if (!premium || !csrfToken) return;

    if (isPremiumCurrent && currentPeriodEnd) {
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
    try {
      const result = await scheduleCheckoutAction({
        planId: pendingSchedulePlan.planId,
        interval: pendingSchedulePlan.interval,
        csrfToken,
      });
      if (result.success) {
        setPendingSchedulePlan(null);
        setIsOpen(false);
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

  const endMs = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : Date.now();
  const remainingMs = Math.max(0, endMs - Date.now());
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  const formattedEndDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "the end of your billing cycle";

  return (
    <>
      {open === undefined && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={triggerClassName}
        >
          {triggerContent || (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Upgrade
            </>
          )}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-inverse-surface/80 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-dialog-title"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-surface-container-high bg-surface-lowest shadow-hard outline-none"
          >
            {/* Top accent stripe */}
            <div className="h-[3px] w-full bg-primary" />

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-[var(--spacing-500)] pt-[var(--spacing-300)] pb-[var(--spacing-300)]">
              <div className="flex items-center gap-[var(--spacing-300)]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="upgrade-dialog-title"
                    className="text-title-medium font-semibold text-on-surface"
                  >
                    {isPremiumCurrent ? "Manage your plan" : "Upgrade to Premium"}
                  </h2>
                  <p className="text-body-small text-outline">
                    {isPremiumCurrent
                      ? currentInterval === "yearly"
                        ? "You're on Premium · billed annually"
                        : currentInterval === "monthly"
                          ? "You're on Premium · billed monthly"
                          : "You're on Premium"
                      : "Unlock higher limits and priority processing"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="rounded-full p-[var(--spacing-100)] text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-surface-container-low" />

            {/* ── Body ── */}
            <div className="px-[var(--spacing-500)] pt-[var(--spacing-300)] pb-[var(--spacing-400)]">
              {premium ? (
                <>
                  {/* ── Limits comparison table ── */}
                  {premium.benefits.length > 0 && (
                    <div className="mb-[var(--spacing-300)]">
                      <PlanComparisonTable data={data} currentTier={currentTier} />
                    </div>
                  )}

                  {/* ── Divider ── */}
                  <div className="mb-[var(--spacing-300)] border-t border-surface-container-low" />

                  {/* ── Billing plan cards ── */}
                  <div className="grid grid-cols-2 gap-[var(--spacing-200)]">
                    <PlanCard
                      label="Monthly"
                      priceLabel={formatMoneyMinor(premium.monthlyPriceMinor, premium.currency)}
                      perLabel="per month"
                      isCurrent={isPremiumCurrent && currentInterval === "monthly"}
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
                      isCurrent={isPremiumCurrent && currentInterval === "yearly"}
                      isLoading={isCheckoutPending}
                      action={premium.yearlyPriceMinor === null ? null : getPlanAction("yearly")}
                      onAction={() => handlePlanSelection("yearly")}
                    />
                  </div>
                </>
              ) : (
                <div
                  className="rounded-xl border border-surface-container-high bg-surface px-[var(--spacing-400)] py-[var(--spacing-300)] text-body-small text-on-surface-variant"
                  role="status"
                >
                  Premium plans are being set up. Please check back soon.
                </div>
              )}

              {checkoutError && (
                <div className="mt-[var(--spacing-300)] rounded-md bg-error-container p-[var(--spacing-200)] text-center text-body-medium text-on-error-container" role="alert">
                  {checkoutError}
                </div>
              )}
            </div>
          </div>

          {/* ── Stacked Pop-up Modal for Schedule Plan Confirmation ── */}
          {pendingSchedulePlan && premium && (
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
                aria-labelledby="upgrade-schedule-modal-title"
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
                      id="upgrade-schedule-modal-title"
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
                        {premium.name} ({currentInterval ?? "Active"})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-outline">Active until:</span>
                      <span className="font-medium text-on-surface">
                        {formattedEndDate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-container-low pt-[var(--spacing-150)]">
                      <span className="text-outline">New scheduled plan:</span>
                      <span className="font-bold text-primary">
                        {premium.name} ({pendingSchedulePlan.interval === "yearly" ? "Yearly" : "Monthly"})
                      </span>
                    </div>
                  </div>

                  <p className="text-body-small text-outline leading-relaxed">
                    Your current plan stays active until {formattedEndDate}. No double charge will occur today.
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

