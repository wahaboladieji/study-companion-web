import { CheckCircle2, Clock, Loader2, AlertTriangle } from "lucide-react";

export function FileStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "READY":
      return (
        <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-success-container px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-success-container">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Ready
        </span>
      );
    case "PROCESSING":
      return (
        <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-primary-container-light px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-primary-container">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Processing
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-error-container px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-error-container">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Failed
        </span>
      );
    case "UPLOADED":
    default:
      return (
        <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-surface-container-high px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-surface-variant">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Uploaded
        </span>
      );
  }
}
