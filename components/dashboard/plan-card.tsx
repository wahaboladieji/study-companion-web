"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PlanAction = "upgrade" | "downgrade";

export function PlanCard({
  label,
  priceLabel,
  perLabel,
  badge,
  isCurrent,
  isLoading,
  action,
  onAction,
}: {
  label: string;
  priceLabel: string | null;
  perLabel: string;
  badge?: string;
  isCurrent: boolean;
  isLoading?: boolean;
  action: PlanAction | null;
  onAction: () => void;
}) {
  const unavailable = priceLabel === null;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border p-[1.25rem] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm",
        isCurrent
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-surface-container-high bg-surface",
        unavailable && "opacity-60 grayscale hover:translate-y-0 hover:shadow-none"
      )}
    >
      {badge && !isCurrent && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-success px-[var(--spacing-150)] py-[var(--spacing-50)] text-label-small font-bold tracking-wide text-on-success shadow-sm" style={{ fontSize: "10px" }}>
          {badge}
        </div>
      )}

      <div className="flex flex-col gap-[var(--spacing-50)]">
        <span
          className={cn(
            "text-label-small font-bold uppercase tracking-wider",
            isCurrent ? "text-primary" : "text-on-surface-variant"
          )}
        >
          {label}
        </span>
      </div>

      <div className="mt-[var(--spacing-150)] flex-1">
        {unavailable ? (
          <p className="text-body-medium text-on-surface-variant">Not available</p>
        ) : (
          <div className="flex flex-col">
            <span className="text-title-large font-bold tracking-tight text-on-surface">
              {priceLabel}
            </span>
            <span className="text-body-small font-medium text-[#999999]">
              {perLabel}
            </span>
          </div>
        )}
      </div>

      <div className="mt-[var(--spacing-200)]">
        {isCurrent ? (
          <div className="flex w-full items-center justify-center gap-[var(--spacing-50)] rounded-lg bg-primary/10 px-[var(--spacing-150)] py-[var(--spacing-100)] text-label-small font-bold text-primary">
            <Check className="h-3 w-3" aria-hidden="true" />
            Current plan
          </div>
        ) : action ? (
          <Button
            type="button"
            variant={action === "downgrade" ? "outline" : "primary"}
            size="sm"
            disabled={isLoading}
            className={cn(
              "w-full transition-all flex items-center justify-center gap-[var(--spacing-100)]",
              action === "upgrade" && "hover:shadow-sm"
            )}
            onClick={onAction}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {!isLoading && (action === "upgrade" ? "Upgrade plan" : "Downgrade plan")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
