import { cn } from "@/lib/utils";

export function Snackbar({
  visible,
  children,
  className,
  variant = "default",
}: {
  visible: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success";
}) {
  const variantClasses =
    variant === "success"
      ? "bg-success-container text-on-success-container"
      : "bg-inverse-surface text-inverse-on-surface";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-[var(--spacing-400)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-[var(--spacing-100)] rounded-md px-[var(--spacing-300)] py-[var(--spacing-150)] text-sm shadow-soft transition-all duration-300",
        variantClasses,
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-[var(--spacing-100)] opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
