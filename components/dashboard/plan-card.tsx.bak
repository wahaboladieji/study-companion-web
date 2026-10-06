"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PlanAction = "upgrade" | "downgrade";

export function PlanCard({
  label,
  priceLabel,
  perLabel,
  badge,
  isCurrent,
  action,
  onAction,
}: {
  label: string;
  priceLabel: string | null;
  perLabel: string;
  badge?: string;
  isCurrent: boolean;
  action: PlanAction | null;
  onAction: () => void;
}) {
  const unavailable = priceLabel === null;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-[var(--spacing-300)]",
        isCurrent
          ? "border-primary bg-primary-container-light"
          : "border-surface-container-high bg-surface",
        unavailable && "opacity-60"
      )}
    >
      <div className="flex items-center justify-between gap-[var(--spacing-100)]">
        <span className="text-label-medium font-medium text-on-surface-variant">{label}</span>
        {badge && !isCurrent && (
          <span className="rounded-full bg-primary px-[var(--spacing-100)] py-px text-label-small font-semibold text-on-primary">
            {badge}
          </span>
        )}
      </div>

      {unavailable ? (
        <p className="mt-[var(--spacing-150)] text-body-medium text-on-surface-variant">
          Not available
        </p>
      ) : (
        <p className="mt-[var(--spacing-150)] flex items-baseline gap-[var(--spacing-50)] text-title-medium font-semibold text-on-surface">
          {priceLabel}
          <span className="text-body-small font-normal text-on-surface-variant">{perLabel}</span>
        </p>
      )}

      <div className="mt-auto pt-[var(--spacing-200)]">
        {isCurrent ? (
          <span className="flex w-full items-center justify-center gap-[var(--spacing-50)] rounded-md bg-primary px-[var(--spacing-100)] py-[var(--spacing-100)] text-label-medium font-semibold text-on-primary">
            <Check className="h-4 w-4" aria-hidden="true" />
            Current plan
          </span>
        ) : action ? (
          <Button
            type="button"
            variant={action === "downgrade" ? "outline" : "primary"}
            size="sm"
            className="w-full"
            onClick={onAction}
          >
            {action === "upgrade" ? "Upgrade plan" : "Downgrade plan"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
