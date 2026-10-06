"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  UploadCloud,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadNotesDialog } from "@/components/dashboard/upload-notes-dialog";
import { deleteCourseAction, type DeleteCourseFormState } from "@/app/actions/course";

type Props = {
  courseId: string;
  courseName: string;
  hasFiles: boolean;
};

export function CourseActionsDropdown({ courseId, courseName, hasFiles }: Props) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    DeleteCourseFormState,
    FormData
  >(deleteCourseAction, null);

  // Fetch CSRF token for delete form
  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => setCsrfToken(data.csrfToken ?? null))
      .catch(() => {});
  }, []);

  // Redirect on successful deletion
  useEffect(() => {
    if (deleteState?.success) {
      router.push("/dashboard");
    }
  }, [deleteState?.success, router]);

  // Click outside to close dropdown menu
  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleDeleteConfirm = () => {
    if (deleteFormRef.current) {
      deleteFormRef.current.requestSubmit();
    }
  };

  return (
    <>
      {/* 3-Dot Dropdown Menu */}
      <div ref={menuRef} className="relative inline-block text-left">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-[var(--spacing-400)] w-[var(--spacing-400)] p-0 border border-outline-variant shrink-0 inline-flex items-center justify-center"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
          aria-label="Course options"
          title="Course options"
        >
          <MoreVertical className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
        </Button>

        {isMenuOpen && (
          <div
            className="absolute right-0 top-full z-30 mt-2 w-48 rounded-xl border border-outline-variant bg-surface-lowest p-1.5 shadow-medium animate-dropdown-pop-in"
            role="menu"
            aria-orientation="vertical"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-body-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:bg-surface-container-low cursor-pointer"
              onClick={() => {
                setIsMenuOpen(false);
                setIsUploadOpen(true);
              }}
            >
              <UploadCloud className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>{hasFiles ? "Upload more" : "Upload files"}</span>
            </button>

            <div className="my-1 border-t border-outline-variant/40" />

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-body-medium text-error transition-colors hover:bg-error-container/20 focus-visible:outline-none focus-visible:bg-error-container/20 cursor-pointer"
              onClick={() => {
                setIsMenuOpen(false);
                setIsDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-error" aria-hidden="true" />
              <span>Delete course</span>
            </button>
          </div>
        )}
      </div>

      {/* Controlled Upload Dialog */}
      <UploadNotesDialog
        courses={[{ id: courseId, name: courseName }]}
        defaultCourseId={courseId}
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-inverse-surface/80 backdrop-blur-sm animate-backdrop-fade-in"
            aria-hidden="true"
            onClick={() => !isDeletePending && setIsDeleteOpen(false)}
          />

          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-outline bg-surface-lowest p-6 shadow-hard animate-modal-pop-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-course-title"
          >
            <form ref={deleteFormRef} action={deleteAction} className="sr-only" aria-hidden="true">
              <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
              <input type="hidden" name="courseId" value={courseId} />
            </form>

            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-error-container text-on-error-container">
                <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeletePending}
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <h3 id="delete-course-title" className="text-title-medium font-semibold text-on-surface">
                Delete &quot;{courseName}&quot;?
              </h3>
              <p className="mt-2 text-body-medium text-on-surface-variant">
                This action cannot be undone. All uploaded files, study notes, and flashcards associated with this course will be permanently removed.
              </p>
            </div>

            {deleteState?.error && (
              <p className="mt-3 text-body-small text-error" role="alert">
                {deleteState.error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeletePending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-error text-on-error hover:bg-error/90 gap-1.5"
                onClick={handleDeleteConfirm}
                disabled={isDeletePending || !csrfToken}
              >
                {isDeletePending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete course
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
