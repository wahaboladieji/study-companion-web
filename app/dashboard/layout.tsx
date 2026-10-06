import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BrainCircuit, FileText, Library, MessageCircle, Sparkles } from "lucide-react";
import { VerificationBanner } from "@/components/verification-banner";
import { VerificationSuccessSnackbar } from "@/components/verification-success-snackbar";
import { UserMenu } from "@/components/dashboard/user-menu";
import { UpgradeDialog } from "@/components/dashboard/upgrade-dialog";
import { getUpgradeDialogData } from "@/services/plans";
import {
  getActiveSubscription,
  inferSubscriptionInterval,
  expireSubscriptionIfDue,
} from "@/services/subscription";
import { Suspense } from "react";

import { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  if (!user.onboarded) {
    redirect("/onboarding");
  }

  const activeSubscription = await getActiveSubscription(user.id);
  const subscriptionExpired = activeSubscription
    ? await expireSubscriptionIfDue(activeSubscription)
    : false;
  const subscriptionTier = subscriptionExpired
    ? "FREE"
    : user.subscriptionTier ?? "FREE";
  const isFreePlan = subscriptionTier.toUpperCase() === "FREE";
  const currentInterval = subscriptionExpired
    ? null
    : inferSubscriptionInterval(activeSubscription);
  const upgradeData = await getUpgradeDialogData();
  const menuUser = subscriptionExpired
    ? { ...user, subscriptionTier: null }
    : user;
  const upgradeTriggerClassName =
    "inline-flex items-center gap-[var(--spacing-100)] rounded-lg bg-primary-container-light px-[var(--spacing-200)] py-[var(--spacing-75)] text-label-medium text-on-primary-container transition-all hover:opacity-90 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  const tierLabel = isFreePlan
    ? "Upgrade"
    : subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1).toLowerCase();
  const upgradeTriggerContent = (
    <>
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      {tierLabel}
    </>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside aria-label="Sidebar" className="hidden sticky top-0 h-screen w-64 flex-col border-r border-surface-container-low bg-surface-lowest md:flex">
        <div className="flex h-14 items-center border-b border-surface-container-low px-[var(--spacing-400)]">
          <Link href="/dashboard" className="flex items-center gap-[var(--spacing-100)]">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <span className="font-bold text-on-surface [font-family:var(--font-open-sans)]">Study Companion</span>
          </Link>
        </div>
        <nav aria-label="Primary" className="flex-1 space-y-[var(--spacing-50)] p-[var(--spacing-200)]">
          <Link
            href="/dashboard"
            className="flex items-center gap-[var(--spacing-150)] rounded-md px-[var(--spacing-200)] py-[0.625rem] text-label-large text-on-surface hover:bg-surface transition-colors"
          >
            <Library className="h-4 w-4" />
            Courses
          </Link>
          <Link
            href="/dashboard/files"
            className="flex items-center gap-[var(--spacing-150)] rounded-md px-[var(--spacing-200)] py-[0.625rem] text-label-large text-on-surface hover:bg-surface transition-colors"
          >
            <FileText className="h-4 w-4" />
            All Files
          </Link>
          <Link
            href="/dashboard/chat"
            className="flex items-center gap-[var(--spacing-150)] rounded-md px-[var(--spacing-200)] py-[0.625rem] text-label-large text-on-surface hover:bg-surface transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            AI Chat
          </Link>
        </nav>
        <div className="border-t border-surface-container-low p-[var(--spacing-200)]">
          <UserMenu user={menuUser} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Desktop Header */}
        <header className="hidden h-14 items-center justify-end border-b border-surface-container-low bg-surface-lowest px-[var(--spacing-400)] md:flex md:px-[var(--spacing-600)]">
          <UpgradeDialog
            data={upgradeData}
            currentTier={subscriptionTier}
            currentInterval={currentInterval}
            cancelAtPeriodEnd={activeSubscription?.cancelAtPeriodEnd}
            currentPeriodEnd={activeSubscription?.currentPeriodEnd?.toISOString() ?? null}
            triggerContent={upgradeTriggerContent}
            triggerClassName={upgradeTriggerClassName}
          />
        </header>

        {/* Mobile Header */}
        <header className="flex h-14 items-center justify-between border-b border-outline bg-surface-lowest px-[var(--spacing-400)] md:hidden">
          <Link href="/dashboard" className="flex items-center gap-[var(--spacing-100)]">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <span className="font-bold text-on-surface [font-family:var(--font-open-sans)]">Study Companion</span>
          </Link>
          <UpgradeDialog
            data={upgradeData}
            currentTier={subscriptionTier}
            currentInterval={currentInterval}
            cancelAtPeriodEnd={activeSubscription?.cancelAtPeriodEnd}
            currentPeriodEnd={activeSubscription?.currentPeriodEnd?.toISOString() ?? null}
            triggerContent={upgradeTriggerContent}
            triggerClassName={upgradeTriggerClassName}
          />
        </header>

        <div className="flex-1 overflow-auto p-[var(--spacing-400)] md:p-[var(--spacing-600)]">
          <Suspense fallback={null}>
            <VerificationSuccessSnackbar />
          </Suspense>
          <VerificationBanner user={user} />
          {children}
        </div>
      </main>
    </div>
  );
}
