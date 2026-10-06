"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Play, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startProcessingAction,
  type StartProcessingFormState,
} from "@/app/actions/processing";

type Props = {
  courseId: string;
  hasProcessableFiles: boolean;
};

/**
 * Client-side "Start Processing" button.
 * Calls startProcessingAction via useActionState, showing live
 * spinner, success, and error states.
 */
export function StartProcessingButton({ courseId, hasProcessableFiles }: Props) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<
    StartProcessingFormState,
    FormData
  >(startProcessingAction, null);

  // Fetch CSRF token on mount
  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) =>
        setCsrfToken(data.csrfToken ?? null)
      )
      .catch(() => {});
  }, []);

  // If no files need processing and we are not currently submitting, do not render an inactive button
  if (!hasProcessableFiles && !isPending) {
    return null;
  }

  const isDisabled = isPending || !csrfToken;

  return (
    <div className="flex flex-col items-end gap-[var(--spacing-100)]">
      {/* Hidden form that holds CSRF + courseId */}
      <form ref={formRef} action={formAction} className="sr-only" aria-hidden="true">
        <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
        <input type="hidden" name="courseId" value={courseId} />
      </form>

      <Button
        type="button"
        className="gap-[var(--spacing-75)] pl-[var(--spacing-150)]"
        disabled={isDisabled}
        onClick={() => {
          if (!isDisabled && formRef.current) {
            formRef.current.requestSubmit();
          }
        }}
        aria-live="polite"
        aria-busy={isPending}
        title={
          !csrfToken
            ? "Loading security token…"
            : "Start AI processing for uploaded files"
        }
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Processing…
          </>
        ) : (
          <>
            <Play className="h-4 w-4" aria-hidden="true" />
            Start processing
          </>
        )}
      </Button>

      {/* Error feedback */}
      {state?.error && (
        <p
          className="flex items-center gap-[var(--spacing-75)] text-body-small text-error"
          role="alert"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </div>
  );
}
