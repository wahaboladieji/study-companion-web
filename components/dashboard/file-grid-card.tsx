"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image,
  Trash2,
  File,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/validations/upload";
import { deleteFileAction, type DeleteFileFormState } from "@/app/actions/upload";
import type { CourseFileSummary } from "@/services/upload";

function getFileColor(fileType: string) {
  if (fileType.startsWith("image/")) return "bg-purple-container-light text-on-purple-container";
  if (fileType === "application/pdf") return "bg-error-container text-on-error-container";
  if (fileType.includes("presentation")) return "bg-tertiary-container text-on-tertiary-container";
  if (fileType.includes("document")) return "bg-primary-container-light text-on-primary-container";
  return "bg-surface-container-high text-on-surface-variant";
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "READY": return "Ready";
    case "PROCESSING": return "Processing";
    case "FAILED": return "Failed";
    case "UPLOADED":
    default: return "Uploaded";
  }
}

export function FileGridCard({
  file,
  courseId,
}: {
  file: CourseFileSummary;
  courseId: string;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, formAction, isPending] = useActionState<DeleteFileFormState, FormData>(deleteFileAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

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

  const colorClass = getFileColor(file.fileType);
  const isImage = file.fileType.startsWith("image/");

  if (state?.success === false && confirmDelete) {
    setConfirmDelete(false);
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-surface-container-high bg-surface-lowest transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      <div className={`flex h-32 items-center justify-center rounded-t-xl ${colorClass}`}>
        {isImage ? (
          <img
            src={`/api/files/${file.id}`}
            alt={file.fileName}
            className="h-full w-full object-cover rounded-t-xl"
          />
        ) : file.fileType === "application/pdf" ? (
          <FileText className="h-12 w-12 opacity-60" aria-hidden="true" />
        ) : file.fileType.includes("presentation") ? (
          <Presentation className="h-12 w-12 opacity-60" aria-hidden="true" />
        ) : (
          <File className="h-12 w-12 opacity-60" aria-hidden="true" />
        )}
      </div>

      <div className="flex items-center gap-[var(--spacing-150)] px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-medium font-medium text-on-surface">
            {file.fileName}
          </p>
          <p className="mt-[var(--spacing-25)] text-body-small text-outline">
            {formatFileSize(file.fileSize)} &middot; {getStatusLabel(file.processingStatus)}
          </p>
        </div>

        <div className="shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-label-small text-error hover:bg-error/10"
                onClick={handleDeleteClick}
                disabled={isPending}
              >
                {isPending ? "..." : "Yes"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-label-small text-on-surface-variant hover:bg-surface-variant"
                onClick={handleCancelDelete}
              >
                No
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-all hover:bg-error/10 hover:text-error"
              aria-label={`Delete ${file.fileName}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {state?.success === false && (
        <p className="px-3 pb-3 text-body-small text-error">
          {state.error}
        </p>
      )}

      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
        <input type="hidden" name="fileId" value={file.id} />
        <input type="hidden" name="courseId" value={courseId} />
      </form>
    </div>
  );
}
