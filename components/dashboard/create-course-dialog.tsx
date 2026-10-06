"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCourseAction } from "@/app/actions/course";
import { Plus, X } from "lucide-react";

export function CreateCourseDialog({
  triggerContent,
  triggerClassName,
}: {
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let active = true;
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => {
        if (active) setCsrfToken(data.csrfToken ?? null);
      })
      .catch(() => {
        if (active) setCsrfToken(null);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const closeDialog = () => {
    setError(null);
    setIsOpen(false);
  };

  const openDialog = () => {
    setError(null);
    setCourseName("");
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    if (!name.trim()) {
      setError("Course name is required");
      return;
    }

    startTransition(async () => {
      const result = await createCourseAction(null, formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success && result.courseId) {
        setIsOpen(false);
        router.push(`/dashboard/course/${result.courseId}`);
      }
    });
  };

  return (
    <>
      <Button className={triggerClassName} onClick={openDialog}>
        {triggerContent || (
          <>
            <Plus className="h-4 w-4" />
            New Course
          </>
        )}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[var(--spacing-400)] sm:p-0">
          <div
            className="fixed inset-0 bg-inverse-surface/80 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          <div
            className="relative z-50 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-outline bg-surface-lowest p-[var(--spacing-200)] shadow-hard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-course-title"
          >
            <div className="flex items-center justify-between mb-[var(--spacing-200)]">
              <h2 id="create-course-title" className="text-title-medium font-semibold text-on-surface">
                Create New Course
              </h2>
              <button
                type="button"
                className="rounded-full p-[var(--spacing-100)] text-on-surface-variant hover:bg-surface hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={closeDialog}
                disabled={isPending}
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--spacing-150)]">
              <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />

              <div className="flex flex-col gap-[var(--spacing-100)]">
                <Label htmlFor="course-name">Course Name</Label>
                <Input
                  id="course-name"
                  name="name"
                  placeholder="e.g. Introduction to Biology"
                  autoFocus
                  required
                  disabled={isPending}
                  maxLength={100}
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="placeholder:text-[var(--primitive-colors-neutral-color-palette-neutral60)] placeholder:text-body-medium"
                />
                <div className="rounded-md bg-primary-container-light px-[var(--spacing-200)] py-[var(--spacing-100)]">
                  <p className="text-body-small text-outline">
                    Give your study space a clear, descriptive name.
                  </p>
                </div>
              </div>

              {error && (
                <div
                  className="rounded-md bg-error-container p-[var(--spacing-200)] text-body-medium text-on-error-container"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending || !csrfToken || !courseName.trim()}>
                  {isPending ? "Creating..." : "Create Course"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
