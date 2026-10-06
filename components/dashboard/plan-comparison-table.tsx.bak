"use client";

import type { UpgradeDialogData } from "@/services/plans";

export function PlanComparisonTable({
  data,
  currentTier,
  premiumOnly = false,
}: {
  data: UpgradeDialogData;
  currentTier?: string | null;
  premiumOnly?: boolean;
}) {
  const premium = data.premium;
  const normalizedTier = (currentTier ?? "FREE").trim().toUpperCase();
  const isFreeCurrent = data.free.name.toUpperCase() === normalizedTier;
  const isPremiumCurrent =
    premium !== null && premium.name.toUpperCase() === normalizedTier;

  if (!premium || premium.benefits.length === 0) {
    return null;
  }

  if (premiumOnly) {
    return (
      <div className="overflow-hidden rounded-xl border border-surface-container-high">
        <div className="flex items-center justify-between border-b border-surface-container-low bg-surface px-[var(--spacing-300)] py-[var(--spacing-100)]">
          <span className="text-label-small font-semibold text-primary">
            {premium.name}
          </span>
          {isPremiumCurrent && (
            <span className="rounded-full bg-primary-container px-[var(--spacing-100)] py-px text-label-small font-semibold text-on-primary-container">
              Current plan
            </span>
          )}
        </div>
        {premium.benefits.map((row, i) => (
          <div
            key={row.label}
            className={[
              "flex items-center justify-between gap-[var(--spacing-200)] px-[var(--spacing-300)] py-[var(--spacing-100)]",
              i !== 0 ? "border-t border-surface-container-low" : "",
            ].join(" ")}
          >
            <span className="text-body-small text-on-surface">{row.label}</span>
            <span className="text-body-small font-semibold text-on-surface">
              {row.premiumValue}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-surface-container-high">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] items-center border-b border-surface-container-low bg-surface px-[var(--spacing-300)] py-[var(--spacing-100)]">
        <span className="text-label-small text-on-surface-variant" />
        <div className="flex min-w-16 flex-col items-center gap-[var(--spacing-25)]">
          <span className="text-label-small font-medium text-on-surface-variant">
            {data.free.name}
          </span>
          {isFreeCurrent && (
            <span className="rounded-full bg-primary-container px-[var(--spacing-100)] py-px text-label-small font-semibold text-on-primary-container">
              Current plan
            </span>
          )}
        </div>
        <div className="flex min-w-20 flex-col items-center gap-[var(--spacing-25)]">
          <span className="text-label-small font-semibold text-primary">
            {premium.name}
          </span>
          {isPremiumCurrent && (
            <span className="rounded-full bg-primary-container px-[var(--spacing-100)] py-px text-label-small font-semibold text-on-primary-container">
              Current plan
            </span>
          )}
        </div>
      </div>

      {/* Rows */}
      {premium.benefits.map((row, i) => (
        <div
          key={row.label}
          className={[
            "grid grid-cols-[1fr_auto_auto] items-center px-[var(--spacing-300)] py-[var(--spacing-100)]",
            i !== 0 ? "border-t border-surface-container-low" : "",
          ].join(" ")}
        >
          <span className="text-body-small text-on-surface">{row.label}</span>
          <span className="w-16 text-center text-body-small text-on-surface-variant">
            {row.freeValue}
          </span>
          <span className="w-20 text-center text-body-small font-semibold text-on-surface">
            {row.premiumValue}
          </span>
        </div>
      ))}
    </div>
  );
}
