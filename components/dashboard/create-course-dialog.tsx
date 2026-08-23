"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCourseAction } from "@/app/actions/course";
import { UploadNotesDialog, type UploadCourseOption } from "@/components/dashboard/upload-notes-dialog";
import { CheckCircle2, Plus, UploadCloud, X } from "lucide-react";

export function CreateCourseDialog({
  courses,
  triggerContent,
  triggerClassName,
}: {
  courses?: UploadCourseOption[];
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdCourse, setCreatedCourse] = useState<{ id: string; name: string } | null>(null);
  const [courseOptions, setCourseOptions] = useState<UploadCourseOption[]>(courses ?? []);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

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
    if (uploadOpen) {
      return;
    }
    setError(null);
    setCreatedCourse(null);
    setIsOpen(false);
  };

  const openDialog = () => {
    setError(null);
    setCreatedCourse(null);
    setUploadOpen(false);
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
        const trimmedName = name.trim();
        setCreatedCourse({ id: result.courseId, name: trimmedName });
        setCourseOptions((prev) =>
          prev.some((course) => course.id === result.courseId)
            ? prev
            : [...prev, { id: result.courseId as string, name: trimmedName }]
        );
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
                disabled={isPending || uploadOpen}
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createdCourse ? (
              <div className="space-y-[var(--spacing-400)]">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-[var(--spacing-200)] flex h-12 w-12 items-center justify-center rounded-full bg-success-container text-on-success-container">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-title-medium font-semibold text-on-surface">Course created</h3>
                  <p className="mt-[var(--spacing-50)] text-body-medium text-on-surface-variant">
                    {createdCourse.name}
                  </p>
                  <p className="mt-[var(--spacing-100)] max-w-sm text-body-small text-on-surface-variant">
                    Upload your handwritten notes now so AI can transcribe and organize them for you.
                    You can also upload files later from the dashboard.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-[var(--spacing-200)] sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Done
                  </Button>
                  <Button type="button" onClick={() => setUploadOpen(true)}>
                    <UploadCloud className="h-4 w-4" />
                    Upload files
                  </Button>
                </div>

                <UploadNotesDialog
                  key={uploadOpen ? "upload-open" : "upload-closed"}
                  courses={courseOptions}
                  defaultCourseId={createdCourse.id}
                  open={uploadOpen}
                  onOpenChange={setUploadOpen}
                />
              </div>
            ) : (
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
                  <Button type="submit" disabled={isPending || !csrfToken}>
                    {isPending ? "Creating..." : "Create Course"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
