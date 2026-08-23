"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserCircle, CreditCard, Settings, LogOut } from "lucide-react";
import { AuthUser } from "@/services/auth";
import { signOutAction } from "@/app/actions/auth";
import { BillingModal } from "@/components/dashboard/billing-modal";

export function UserMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstItem = containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-[var(--spacing-150)] rounded-md px-[var(--spacing-200)] py-[var(--spacing-100)] text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container font-bold text-on-primary-container">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-col truncate">
          <span className="truncate text-label-large text-on-surface">{user.name}</span>
          <span className="truncate text-body-small text-outline">
            {user.subscriptionTier ? user.subscriptionTier.toLowerCase() === "free" ? "Free plan" : user.subscriptionTier.toUpperCase() : "Free plan"}
          </span>
        </div>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute bottom-full right-0 z-50 mb-[var(--spacing-100)] w-56 rounded-md border border-surface-container-low bg-surface-lowest p-[var(--spacing-100)] shadow-soft"
        >
          <Link
            href="/dashboard/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-[var(--spacing-150)] rounded-md px-[var(--spacing-200)] py-[var(--spacing-150)] text-label-large text-on-surface transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UserCircle className="h-4 w-4" />
            My Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setBillingOpen(true);
            }}
            className="flex w-full items-center gap-[var(--spacing-150)] rounded-md px-[var(--spacing-200)] py-[var(--spacing-150)] text-label-large text-on-surface transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CreditCard className="h-4 w-4" />
            Billing
          </button>
          <Link
            href="/dashboard/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-[var(--spacing-150)] rounded-md px-[var(--spacing-200)] py-[var(--spacing-150)] text-label-large text-on-surface transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <form action={signOutAction} className="mt-[var(--spacing-50)] border-t border-surface-container-low pt-[var(--spacing-50)]">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-[var(--spacing-150)] rounded-md px-[var(--spacing-200)] py-[var(--spacing-150)] text-label-large text-error transition-colors hover:bg-error-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      )}

      <BillingModal
        key={billingOpen ? "billing-open" : "billing-closed"}
        open={billingOpen}
        onOpenChange={setBillingOpen}
      />
    </div>
  );
}
