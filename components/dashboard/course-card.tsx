"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, ArrowRight, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteCourseAction, type DeleteCourseFormState } from "@/app/actions/course";
import { UploadNotesDialog } from "@/components/dashboard/upload-notes-dialog";

export type CourseCardData = {
  id: string;
  name: string;
  createdAt: Date;
  fileCount: number;
};

function formatCreatedDate(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear().toString().slice(-2);
  return `Created ${m}/${d}/${y}`;
}

export function CourseCard({
  course,
  courseOptions,
}: {
  course: CourseCardData;
  courseOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, formAction, isPending] = useActionState<DeleteCourseFormState, FormData>(deleteCourseAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => setCsrfToken(data.csrfToken ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [state?.success, router]);

  if (state?.success) {
    return null;
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete) {
      formRef.current?.requestSubmit();
    } else {
      setConfirmDelete(true);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsUploadOpen(true);
  };

  return (
    <>
      <Link
        href={`/dashboard/course/${course.id}`}
        className={cn(
          "group relative flex flex-col rounded-xl border bg-surface-lowest p-[1.25rem] transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-soft",
          state?.success
            ? "border-error/30 opacity-50"
            : "border-surface-container-high hover:border-primary/40"
        )}
      >
        <div className="flex items-start justify-between gap-[var(--spacing-150)]">
          <div className="min-w-0">
            <h3 className="text-title-medium font-medium text-on-surface line-clamp-1">
              {course.name}
            </h3>
            <p className="text-body-small text-[var(--primitive-colors-neutral-color-palette-neutral60)] mt-0.5">
              {formatCreatedDate(course.createdAt)}
            </p>
          </div>

          <div className="shrink-0" onClick={(e) => e.preventDefault()}>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-label-small text-error hover:bg-error/10"
                  onClick={handleDeleteClick}
                  disabled={isPending}
                >
                  {isPending ? "Deleting..." : "Confirm"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-label-small text-on-surface-variant hover:bg-surface-variant"
                  onClick={handleCancelDelete}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-all hover:bg-error/10 hover:text-error"
                aria-label={`Delete ${course.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-auto pt-[var(--spacing-400)] flex items-center justify-between">
          {course.fileCount > 0 ? (
            <>
              <span className="text-body-medium text-outline">
                {course.fileCount} {course.fileCount === 1 ? "file" : "files"}
              </span>
              <span className="inline-flex items-center gap-1 text-body-medium text-primary hover:underline">
                View course
                <ArrowRight className="h-4 w-4" />
              </span>
            </>
          ) : (
            <>
              <span className="text-body-medium text-outline">No files yet</span>
              <button
                type="button"
                onClick={handleUploadClick}
                className="inline-flex items-center gap-[var(--spacing-75)] text-body-medium text-primary hover:underline"
                aria-label={`Upload files to ${course.name}`}
              >
                <UploadCloud className="h-4 w-4" />
                Upload
              </button>
            </>
          )}
        </div>

        <form ref={formRef} action={formAction} className="hidden">
          <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
          <input type="hidden" name="courseId" value={course.id} />
        </form>
      </Link>

      {/* Rendered outside <Link> to avoid nesting/stacking-context glitches */}
      <UploadNotesDialog
        courses={courseOptions}
        defaultCourseId={course.id}
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
      />
    </>
  );
}
