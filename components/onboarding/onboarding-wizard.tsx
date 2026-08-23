"use client";

import { useActionState, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboardingAction } from "@/app/actions/onboarding";
import { cn } from "@/lib/utils";

type Step = {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  bullets: string[];
};

const STEPS: Step[] = [
  {
    icon: BrainCircuit,
    label: "Step 1 of 3",
    title: "Everything you need to study, in one place",
    body: "Upload your PDFs, slides, and notes once. The AI turns them into clear study notes and flashcards — no manual prep.",
    bullets: [
      "AI-generated study notes from your materials",
      "Smart flashcards built from your content",
      "Chat with your documents and get grounded answers",
    ],
  },
  {
    icon: Sparkles,
    label: "Step 2 of 3",
    title: "Start free. Upgrade when you grow.",
    body: "The Free plan is yours to keep — 3 courses, 10 uploads, and 5 AI generations every month.",
    bullets: [
      "Premium unlocks unlimited courses and uploads",
      "More AI generations for notes, flashcards, and chat",
      "Upgrade anytime, no lock-in",
    ],
  },
  {
    icon: GraduationCap,
    label: "Step 3 of 3",
    title: "Your first study session in three moves",
    body: "From upload to mastery — here's how the loop works:",
    bullets: [
      "Add a course and upload your materials",
      "AI generates notes and flashcards",
      "Review, chat, and track your progress",
    ],
  },
];

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [, formAction, isPending] = useActionState(completeOnboardingAction, null);

  const current = STEPS[step];

  const handleNext = () => setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const handleBack = () => setStep((prev) => Math.max(prev - 1, 0));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-[var(--spacing-400)]">
      <div className="w-full max-w-md space-y-[var(--spacing-400)] rounded-xl border border-outline bg-surface-lowest p-[var(--spacing-600)] text-center shadow-medium">
        <div className="flex items-center gap-[var(--spacing-200)]">
          <div
            className="flex flex-1 gap-[var(--spacing-50)]"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={0}
            aria-valuemax={STEPS.length - 1}
            aria-valuenow={step}
          >
            {STEPS.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setStep(index)}
                aria-label={`Go to step ${index + 1}`}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  index <= step ? "bg-primary" : "bg-surface-container-high hover:bg-surface-container-highest",
                )}
              />
            ))}
          </div>
          {step < STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => setStep(STEPS.length - 1)}
              className="inline-flex shrink-0 items-center gap-[var(--spacing-50)] rounded-full bg-primary-container-light px-[var(--spacing-150)] py-[var(--spacing-50)] text-label-small text-on-surface transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Skip
              <ChevronRight className="h-4 w-4 text-primary" />
            </button>
          )}
        </div>

        <div className="space-y-[var(--spacing-200)]">
          <p className="text-label-small text-on-surface-variant">
            {current.label}
          </p>
          <div className="flex justify-center">
            <div className="flex h-[var(--spacing-600)] w-[var(--spacing-600)] items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <current.icon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="space-y-[var(--spacing-100)]">
          <h1 className="text-headline-small text-on-surface">{current.title}</h1>
          <p className="text-body-medium text-on-surface-variant">{current.body}</p>
        </div>

        <ul className="space-y-[var(--spacing-100)] text-left">
          {current.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-[var(--spacing-100)] text-body-medium text-on-surface"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {step < STEPS.length - 1 ? (
          <div className="flex gap-[var(--spacing-150)]">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button type="button" onClick={handleNext} className="flex-1">
              Next
            </Button>
          </div>
        ) : (
          <form action={formAction}>
            <div className="flex gap-[var(--spacing-150)]">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? "Setting things up..." : "Get Started!"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
