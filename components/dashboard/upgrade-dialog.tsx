"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { formatMoneyMinor } from "@/lib/money";
import { PlanCard } from "@/components/dashboard/plan-card";
import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import type { UpgradeDialogData } from "@/services/plans";
import type { SubscriptionInterval } from "@/services/subscription";

export function UpgradeDialog({
  data,
  currentTier,
  currentInterval,
  triggerContent,
  triggerClassName,
  open,
  onOpenChange,
}: {
  data: UpgradeDialogData;
  currentTier?: string | null;
  currentInterval?: SubscriptionInterval | null;
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
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
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setIsOpen]);

  const premium = data.premium;
  const normalizedTier = (currentTier ?? "FREE").trim().toUpperCase();
  const isPremiumCurrent =
    premium !== null && premium.name.toUpperCase() === normalizedTier;

  const getPlanAction = (
    interval: "monthly" | "yearly"
  ): "upgrade" | "downgrade" | null => {
    if (!isPremiumCurrent) return "upgrade";
    if (currentInterval === interval) return null;
    if (currentInterval === "monthly" && interval === "yearly") return "upgrade";
    if (currentInterval === "yearly" && interval === "monthly") return "downgrade";
    return null;
  };

  const goToCheckout = (interval: "monthly" | "yearly") => {
    if (!premium) return;
    setIsOpen(false);
    router.push(
      `/dashboard/billing?planId=${encodeURIComponent(premium.id)}&interval=${interval}`
    );
  };

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
            className="fixed inset-0 animate-backdrop-fade-in bg-inverse-surface/80 backdrop-blur-sm"
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
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] animate-modal-scale-in -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-surface-container-high bg-surface-lowest shadow-hard outline-none"
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
                  <p className="text-body-small text-on-surface-variant">
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
                      isCurrent={isPremiumCurrent && currentInterval === "yearly"}
                      action={premium.yearlyPriceMinor === null ? null : getPlanAction("yearly")}
                      onAction={() => goToCheckout("yearly")}
                    />
                  </div>

                  {/* ── Footer note ── */}
                  <p className="mt-[var(--spacing-300)] text-center text-label-small text-on-surface-variant">
                    Cancel or switch anytime · Secure checkout via Flutterwave
                  </p>
                </>
              ) : (
                <p
                  className="rounded-xl border border-surface-container-high bg-surface px-[var(--spacing-400)] py-[var(--spacing-300)] text-body-small text-on-surface-variant"
                  role="status"
                >
                  Premium plans are being set up. Please check back soon.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

