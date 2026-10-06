"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCourseAction, type DeleteCourseFormState } from "@/app/actions/course";

type Props = {
  courseId: string;
  courseName: string;
};

export function DeleteCourseButton({ courseId, courseName }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<DeleteCourseFormState, FormData>(
    deleteCourseAction,
    null
  );

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => setCsrfToken(data.csrfToken ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard");
    }
  }, [state?.success, router]);

  const handleDelete = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  return (
    <>
      <form ref={formRef} action={formAction} className="sr-only" aria-hidden="true">
        <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
        <input type="hidden" name="courseId" value={courseId} />
      </form>

      {!showConfirm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-error border-error/30 hover:bg-error/10 hover:text-error"
          onClick={() => setShowConfirm(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete course
        </Button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/20 px-3 py-1.5 text-body-small">
          <div className="flex items-center gap-1.5 text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Delete &quot;{courseName}&quot;?</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 bg-error text-on-error hover:bg-error/90"
            onClick={handleDelete}
            disabled={isPending || !csrfToken}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
          </Button>
        </div>
      )}

      {state?.error && (
        <p className="text-body-small text-error" role="alert">
          {state.error}
        </p>
      )}
    </>
  );
}
