import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    // Map our token colors and spacing to Tailwind utility classes (which we mapped in globals.css)
    const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-primary text-on-primary hover:opacity-90 hover:shadow-soft",
      secondary: "bg-secondary text-on-secondary hover:opacity-90 hover:shadow-soft",
      outline: "border border-outline text-on-surface hover:bg-surface-lowest",
      ghost: "hover:bg-surface-lowest text-on-surface",
    };
    
    const sizes = {
      sm: "h-[var(--spacing-400)] px-[var(--spacing-150)] text-label-small",
      md: "h-[var(--spacing-500)] px-[var(--spacing-200)] py-[var(--spacing-100)] text-label-medium",
      lg: "h-[var(--spacing-600)] px-[var(--spacing-400)] text-label-large",
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
