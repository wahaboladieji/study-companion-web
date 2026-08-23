"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  uploadNotesAction,
  getCourseFilesAction,
  type UploadNotesFormState,
} from "@/app/actions/upload";
import {
  validateUploadFile,
  formatFileSize,
} from "@/lib/validations/upload";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadCourseOption = { id: string; name: string };

const ACCEPTED_TYPES = ".pdf,.docx,.pptx,.jpg,.jpeg,.png";
const POLL_INTERVAL_MS = 3000;

type UploadItemStatus = "queued" | "rejected" | "processing" | "ready" | "failed";

type UploadItem = {
  key: string;
  fileName: string;
  fileSize: number;
  status: UploadItemStatus;
  error?: string;
  duplicate: boolean;
  fileId?: string;
  file?: File;
};

function StatusBadge({ item, isPending }: { item: UploadItem; isPending: boolean }) {
  switch (item.status) {
    case "processing":
      return (
        <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-primary-container-light px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-primary-container">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Processing
        </span>
      );
    case "ready":
      return (
        <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-success-container px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-success-container">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Ready
        </span>
      );
    case "failed":
    case "rejected":
      return (
        <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-error-container px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-error-container">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {item.status === "failed" ? "Failed" : "Not supported"}
        </span>
      );
    case "queued":
    default:
      if (isPending) {
        return (
          <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-primary-container-light px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-primary-container">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Uploading
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-surface-container-high px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-surface-variant">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Ready to upload
        </span>
      );
  }
}

let localKeyCounter = 0;

function nextKey(): string {
  localKeyCounter += 1;
  return `upload-item-${localKeyCounter}`;
}

export function UploadNotesDialog({
  courses,
  defaultCourseId,
  triggerContent,
  triggerClassName,
  triggerVariant = "primary",
  open,
  onOpenChange,
}: {
  courses: UploadCourseOption[];
  defaultCourseId?: string;
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
  triggerVariant?: "primary" | "secondary" | "outline" | "ghost";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = useCallback(
    (next: boolean) => {
      if (onOpenChange) {
        onOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [onOpenChange]
  );

  const [selectedCourseId, setSelectedCourseId] = useState(
    defaultCourseId ?? courses[0]?.id ?? ""
  );
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);
  const [activeCourseIndex, setActiveCourseIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const courseMenuRef = useRef<HTMLDivElement>(null);
  const courseOptionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const resetState = () => {
    setItems([]);
    setError(null);
    setSelectedCourseId(defaultCourseId ?? courses[0]?.id ?? "");
    setIsCourseMenuOpen(false);
    setActiveCourseIndex(0);
  };

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);

  const openCourseMenu = () => {
    const index = courses.findIndex((course) => course.id === selectedCourseId);
    setActiveCourseIndex(index >= 0 ? index : 0);
    setIsCourseMenuOpen(true);
  };

  const selectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setIsCourseMenuOpen(false);
  };

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

  useEffect(() => {
    if (!isCourseMenuOpen || courses.length === 0) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setIsCourseMenuOpen(false);
        return;
      }
      if (event.key === "Tab") {
        setIsCourseMenuOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCourseIndex((index) => Math.min(courses.length - 1, index + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCourseIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const course = courses[activeCourseIndex];
        if (course) {
          selectCourse(course.id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isCourseMenuOpen, courses, activeCourseIndex]);

  useEffect(() => {
    if (!isCourseMenuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!courseMenuRef.current?.contains(event.target as Node)) {
        setIsCourseMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isCourseMenuOpen]);

  useEffect(() => {
    if (!isCourseMenuOpen) {
      return;
    }
    courseOptionRefs.current[activeCourseIndex]?.scrollIntoView({ block: "nearest" });
  }, [isCourseMenuOpen, activeCourseIndex]);

  const hasQueued = items.some((item) => item.status === "queued");
  const hasProcessing = items.some((item) => item.status === "processing");
  const queuedCount = items.filter((item) => item.status === "queued").length;
  const canUpload = courses.length > 0 && selectedCourseId && queuedCount > 0 && !isPending && !!csrfToken;

  const router = useRouter();
  const uploadedReady = items.filter((item) => item.status === "ready").length;
  const uploadedProcessing = items.filter((item) => item.status === "processing").length;
  const uploadedFailed = items.filter((item) => item.status === "failed").length;
  const hasUploaded = uploadedReady > 0 || uploadedProcessing > 0 || uploadedFailed > 0;
  const allUploadsDone = hasUploaded && uploadedProcessing === 0;
  const allUploadsFailed = allUploadsDone && uploadedReady === 0 && uploadedFailed > 0;

  const goToCourse = () => {
    if (!selectedCourseId) {
      return;
    }
    setIsOpen(false);
    router.push(`/dashboard/course/${selectedCourseId}`);
  };

  const addFiles = (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      return;
    }
    setError(null);
    setItems((prev) => {
      const next = [...prev];
      for (const file of files) {
        const validation = validateUploadFile(file.name, file.type, file.size);
        if (!validation.ok) {
          next.push({
            key: nextKey(),
            fileName: file.name,
            fileSize: file.size,
            status: "rejected",
            error: validation.error,
            duplicate: false,
            file,
          });
        } else {
          next.push({
            key: nextKey(),
            fileName: file.name,
            fileSize: file.size,
            status: "queued",
            duplicate: false,
            file,
          });
        }
      }
      return next;
    });
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleSubmit = () => {
    if (!selectedCourseId || queuedCount === 0) {
      return;
    }
    if (!csrfToken) {
      setError("Security check failed. Please refresh the page and try again.");
      return;
    }
    setError(null);

    const queuedItems = items.filter((item) => item.status === "queued");
    const formData = new FormData();
    formData.set("csrfToken", csrfToken);
    formData.set("courseId", selectedCourseId);
    for (const item of queuedItems) {
      if (item.file) {
        formData.append("files", item.file, item.file.name);
      }
    }

    startTransition(async () => {
      let result: UploadNotesFormState;
      try {
        result = await uploadNotesAction(null, formData);
      } catch {
        setError("Something went wrong while uploading. Please try again.");
        return;
      }

      if (result?.error) {
        setError(result.error);
      }

      if (result?.files && result.files.length > 0) {
        const results = result.files;
        setItems((prev) => {
          const next = [...prev];
          const queuedIndexes: number[] = [];
          next.forEach((item, index) => {
            if (item.status === "queued") {
              queuedIndexes.push(index);
            }
          });

          results.forEach((res, index) => {
            const itemIndex = queuedIndexes[index];
            if (itemIndex === undefined) {
              return;
            }
            const current = next[itemIndex];
            if (res.error) {
              next[itemIndex] = {
                ...current,
                status: "failed",
                error: res.error,
                duplicate: res.duplicate,
              };
            } else {
              next[itemIndex] = {
                ...current,
                status: "processing",
                fileId: res.id,
                duplicate: res.duplicate,
              };
            }
          });
          return next;
        });
      }
    });
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    drawerRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isPending, setIsOpen]);

  useEffect(() => {
    if (!isOpen || !hasProcessing || !selectedCourseId) {
      return;
    }

    let cancelled = false;

    const syncStatuses = async () => {
      const files = await getCourseFilesAction(selectedCourseId);
      if (cancelled) {
        return;
      }
      const byId = new Map(files.map((file) => [file.id, file]));
      setItems((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          if (item.status !== "processing" || !item.fileId) {
            return item;
          }
          const server = byId.get(item.fileId);
          if (!server) {
            return item;
          }
          if (server.processingStatus === "READY") {
            changed = true;
            return { ...item, status: "ready" as const };
          }
          if (server.processingStatus === "FAILED") {
            changed = true;
            return {
              ...item,
              status: "failed" as const,
              error: "Processing failed. Remove this file and try uploading it again.",
            };
          }
          return item;
        });
        return changed ? next : prev;
      });
    };

    const interval = setInterval(syncStatuses, POLL_INTERVAL_MS);
    syncStatuses();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen, hasProcessing, selectedCourseId]);

  const renderCourseField = () => {
    if (courses.length === 0) {
      return (
        <div className="rounded-md border border-dashed border-outline bg-surface p-[var(--spacing-300)] text-body-medium text-on-surface-variant">
          You don&apos;t have any courses yet. Create a course first, then upload your notes to it.
        </div>
      );
    }

    return (
      <div className="space-y-[var(--spacing-100)]">
        <Label id="upload-course-label" htmlFor="upload-course-trigger">
          Course
        </Label>
        <div ref={courseMenuRef} className="relative">
          <button
            type="button"
            id="upload-course-trigger"
            role="combobox"
            aria-haspopup="listbox"
            aria-controls={isCourseMenuOpen ? "upload-course-listbox" : undefined}
            aria-expanded={isCourseMenuOpen}
            aria-labelledby="upload-course-label upload-course-trigger"
            aria-activedescendant={
              isCourseMenuOpen ? `upload-course-option-${activeCourseIndex}` : undefined
            }
            onClick={() => (isCourseMenuOpen ? setIsCourseMenuOpen(false) : openCourseMenu())}
            disabled={isPending}
            className="flex h-[var(--spacing-500)] w-full items-center justify-between gap-[var(--spacing-100)] rounded-md border border-[var(--color-surface-container-high)] bg-surface-lowest px-4 text-left text-sm tracking-[-0.75px] text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="truncate">{selectedCourse?.name ?? "Select a course"}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-on-surface-variant transition-transform duration-200",
                isCourseMenuOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>

          {isCourseMenuOpen && (
            <div
              id="upload-course-listbox"
              role="listbox"
              aria-labelledby="upload-course-label"
              className="absolute inset-x-0 top-full z-10 mt-[var(--spacing-50)] max-h-60 overflow-y-auto rounded-lg border border-outline-variant bg-surface-lowest p-[var(--spacing-50)] shadow-medium animate-dropdown-pop-in"
            >
              {courses.map((course, index) => {
                const isSelected = course.id === selectedCourseId;
                const isActive = index === activeCourseIndex;
                return (
                  <div
                    key={course.id}
                    id={`upload-course-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    ref={(node) => {
                      courseOptionRefs.current[index] = node;
                    }}
                    onMouseEnter={() => setActiveCourseIndex(index)}
                    onClick={() => selectCourse(course.id)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-[var(--spacing-100)] rounded-md px-4 py-[var(--spacing-100)] text-body-medium transition-colors",
                      isSelected
                        ? "bg-primary-container-light text-on-primary-container"
                        : "text-on-surface",
                      isActive && !isSelected && "bg-surface-container-low"
                    )}
                  >
                    <span className="truncate">{course.name}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-on-primary-container" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {open === undefined && (
        <Button className={triggerClassName} variant={triggerVariant} onClick={() => {
          resetState();
          setIsOpen(true);
        }}>
          {triggerContent || (
            <>
              <UploadCloud className="h-4 w-4" />
              Upload Notes
            </>
          )}
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 animate-backdrop-fade-in bg-inverse-surface/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          <div
            ref={drawerRef}
            tabIndex={-1}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md animate-drawer-slide-in flex-col border-l border-outline bg-surface-lowest shadow-hard outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-notes-title"
          >
            <div className="flex items-start justify-between gap-[var(--spacing-200)] border-b border-surface-container-low px-5 py-[var(--spacing-500)]">
              <div>
                <h2 id="upload-notes-title" className="text-title-medium font-semibold text-on-surface">
                  Upload Notes
                </h2>
                <p className="mt-[var(--spacing-50)] text-body-small text-outline">
                  Add handwritten notes and study materials so AI can transcribe and organize them.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-[var(--spacing-100)] text-on-surface-variant hover:bg-surface hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-[var(--spacing-400)] overflow-y-auto px-5 py-[var(--spacing-500)]">
              {renderCourseField()}

              {courses.length > 0 && (
                <>
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border border-dashed p-[var(--spacing-500)] text-center transition-colors",
                      isDragging
                        ? "border-primary bg-primary-container-light/50"
                        : "border-outline bg-surface"
                    )}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDragging(false);
                      addFiles(event.dataTransfer.files);
                    }}
                  >
                    <UploadCloud
                      className="mb-[var(--spacing-150)] h-8 w-8 text-primary"
                      aria-hidden="true"
                    />
                    <p className="text-body-medium text-on-surface">
                      Drag &amp; drop your notes here
                    </p>
                    <p className="mt-[var(--spacing-25)] text-body-small text-on-surface-variant">or</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-[var(--spacing-150)]"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isPending}
                    >
                      Browse files
                    </Button>
                    <p className="mt-[var(--spacing-150)] text-body-small text-on-surface-variant">
                      PDF, DOCX, PPTX, JPG, JPEG, PNG &middot; up to 20MB each
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED_TYPES}
                      className="sr-only"
                      onChange={(event) => {
                        addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </div>

                  {items.length > 0 && (
                    <ul className="space-y-[var(--spacing-100)]">
                      {items.map((item) => (
                        <li
                          key={item.key}
                          className="flex items-start gap-[var(--spacing-150)] rounded-md border border-surface-container-high bg-surface-lowest p-[var(--spacing-150)]"
                        >
                          <FileText className="mt-[var(--spacing-25)] h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-[var(--spacing-100)]">
                              <p className="truncate text-body-medium text-on-surface">{item.fileName}</p>
                              <StatusBadge item={item} isPending={isPending} />
                            </div>
                            <p className="mt-[var(--spacing-25)] text-body-small text-on-surface-variant">
                              {formatFileSize(item.fileSize)}
                            </p>
                            {item.error && (
                              <p className="mt-[var(--spacing-25)] text-body-small text-error">{item.error}</p>
                            )}
                            {item.duplicate && item.status !== "queued" && (
                              <p className="mt-[var(--spacing-25)] flex items-center gap-[var(--spacing-50)] text-body-small text-on-surface-variant">
                                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                A file with this name already exists in this course. It was added as a separate file.
                              </p>
                            )}
                          </div>
                          {item.status === "queued" && !isPending && (
                            <button
                              type="button"
                              className="rounded-full p-[var(--spacing-100)] text-on-surface-variant hover:bg-surface hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              onClick={() => removeItem(item.key)}
                              aria-label={`Remove ${item.fileName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {error && (
                <div
                  className="rounded-md bg-error-container p-[var(--spacing-200)] text-body-medium text-on-error-container"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {hasUploaded && (
                <div className="space-y-[var(--spacing-300)] rounded-lg border border-surface-container-high bg-surface p-[var(--spacing-400)]">
                  <div className="flex items-start gap-[var(--spacing-150)]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-container text-on-success-container">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-title-medium font-semibold text-on-surface">
                        {allUploadsFailed
                          ? "Upload needs attention"
                          : allUploadsDone
                            ? "Upload complete"
                            : "Upload in progress"}
                      </h3>
                      <p className="mt-[var(--spacing-25)] text-body-small text-on-surface-variant">
                        {allUploadsFailed
                          ? `${uploadedFailed} file${uploadedFailed === 1 ? " has" : "s have"} failed to process. Remove them and try again, or open your course to review.`
                          : allUploadsDone
                            ? uploadedFailed > 0
                              ? `${uploadedReady} file${uploadedReady === 1 ? " is" : "s are"} ready and ${uploadedFailed} failed. Open your course to continue.`
                              : `${uploadedReady} file${uploadedReady === 1 ? " is" : "s are"} ready. Open your course to continue.`
                            : `${uploadedProcessing} file${uploadedProcessing === 1 ? " is" : "s are"} still processing. You can close this drawer and check progress in your course.`}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-label-medium font-medium text-on-surface">What&apos;s next</p>
                    <ol className="mt-[var(--spacing-100)] space-y-[var(--spacing-100)]">
                      {[
                        "Open your course to review your files",
                        "Generate AI Study Notes on demand",
                        "Generate AI Flashcards on demand",
                        "Chat with your course materials",
                      ].map((step, index) => (
                        <li
                          key={step}
                          className="flex items-start gap-[var(--spacing-100)] text-body-medium text-on-surface"
                        >
                          <span
                            className="mt-[var(--spacing-25)] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container-light text-label-small text-on-primary-container"
                            aria-hidden="true"
                          >
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <Button type="button" onClick={goToCourse} className="w-full">
                    Go to {courses.find((course) => course.id === selectedCourseId)?.name || "course"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-surface-container-low px-5 py-[var(--spacing-400)]">
              <div className="flex flex-col gap-[var(--spacing-200)] sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-md bg-primary-container-light px-[var(--spacing-200)] py-[var(--spacing-100)]">
                  <p className="text-body-small text-outline">
                    AI Study Notes and Flashcards are generated on demand once your files finish processing.
                  </p>
                </div>
                {hasQueued && (
                  <Button type="button" onClick={handleSubmit} disabled={!canUpload} className="sm:shrink-0">
                    {isPending
                      ? "Uploading..."
                      : `Upload ${queuedCount} file${queuedCount === 1 ? "" : "s"}`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
