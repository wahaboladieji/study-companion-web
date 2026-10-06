"use client";

import { useEffect, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { FileGridCard } from "@/components/dashboard/file-grid-card";
import { UploadNotesDialog } from "@/components/dashboard/upload-notes-dialog";
import { getCourseFilesAction } from "@/app/actions/upload";
import type { CourseFileSummary } from "@/services/upload";

type Props = {
  courseId: string;
  courseName?: string;
  initialFiles: CourseFileSummary[];
};

export function CourseFilesPoller({ courseId, courseName, initialFiles }: Props) {
  const [files, setFiles] = useState<CourseFileSummary[]>(initialFiles);

  // Sync state when initialFiles prop updates from server revalidation
  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const hasUnfinished = files.some(
    (f) => f.processingStatus === "PROCESSING"
  );

  useEffect(() => {
    if (!hasUnfinished) return;

    const interval = setInterval(async () => {
      try {
        const updatedFiles = await getCourseFilesAction(courseId);
        if (updatedFiles && updatedFiles.length > 0) {
          setFiles(updatedFiles);
        }
      } catch (err) {
        console.warn("[CourseFilesPoller] Poll error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [courseId, hasUnfinished]);

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline bg-surface-lowest p-[var(--spacing-600)] text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container-light text-on-primary-container mb-[var(--spacing-200)]">
          <FileText className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-title-medium font-semibold text-on-surface">
          No files yet
        </h3>
        <p className="mt-[var(--spacing-50)] max-w-sm text-body-medium text-on-surface-variant mb-[var(--spacing-300)]">
          Upload your handwritten notes and study materials so AI can
          transcribe and organize them.
        </p>
        {courseName && (
          <UploadNotesDialog
            courses={[{ id: courseId, name: courseName }]}
            defaultCourseId={courseId}
            triggerVariant="primary"
            triggerContent={
              <>
                <UploadCloud className="h-4 w-4" />
                Upload files
              </>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-[var(--spacing-300)] sm:grid-cols-3 lg:grid-cols-4">
      {files.map((file) => (
        <FileGridCard key={file.id} file={file} courseId={courseId} />
      ))}
    </div>
  );
}
