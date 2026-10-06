import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/services/auth";
import { getCourseDetail } from "@/services/course";
import { StudyNotesExportButton } from "@/components/dashboard/study-notes-export-button";
import { StudyNotesView } from "@/components/dashboard/study-notes-view";
import { ChatWithAiTutorButton } from "@/components/dashboard/chat-with-ai-tutor-button";
import { StartProcessingButton } from "@/components/dashboard/start-processing-button";
import { CourseFilesPoller } from "@/components/dashboard/course-files-poller";
import { ProcessingStatusBanner } from "@/components/dashboard/processing-status-banner";
import { CourseActionsDropdown } from "@/components/dashboard/course-actions-dropdown";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const course = await getCourseDetail(user.id, id);
  if (!course) {
    notFound();
  }

  const hasFiles = course.files.length > 0;
  const hasProcessableFiles = course.files.some(
    (file) => file.processingStatus === "UPLOADED" || file.processingStatus === "FAILED"
  );
  const hasProcessingFiles = course.files.some(
    (file) => file.processingStatus === "PROCESSING"
  );

  return (
    <div className="space-y-[var(--spacing-400)]">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-[var(--spacing-100)] rounded-sm text-label-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to courses
      </Link>

      <div className="flex flex-col gap-[var(--spacing-300)] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-headline-small font-semibold text-on-surface">
            {course.name}
          </h1>
          <p className="mt-[var(--spacing-25)] text-body-small text-on-surface-variant">
            Created on{" "}
            {new Date(course.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[var(--spacing-200)]">
          {course.studyNotes.length > 0 && (
            <span className="inline-flex items-center gap-[var(--spacing-50)] rounded-full bg-success-container px-[var(--spacing-100)] py-[var(--spacing-25)] text-label-medium text-on-success-container">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Processed
            </span>
          )}
          {hasFiles && (
            <StartProcessingButton
              courseId={course.id}
              hasProcessableFiles={hasProcessableFiles}
            />
          )}
          {course.studyNotes[0] && (
            <StudyNotesExportButton note={course.studyNotes[0]} />
          )}
          <CourseActionsDropdown
            courseId={course.id}
            courseName={course.name}
            hasFiles={hasFiles}
          />
        </div>
      </div>

      <ProcessingStatusBanner
        courseId={course.id}
        initialProcessing={hasProcessingFiles}
      />

      {/* Course Files Section */}
      <section aria-labelledby="course-files-heading" className="space-y-[var(--spacing-200)]">
        <div className="flex items-center justify-between">
          <h2 id="course-files-heading" className="text-title-medium font-semibold text-on-surface">
            Course Files
          </h2>
          <span className="text-body-small text-outline">
            {course.files.length}{" "}
            {course.files.length === 1 ? "file" : "files"}
          </span>
        </div>
        <CourseFilesPoller
          courseId={course.id}
          courseName={course.name}
          initialFiles={course.files}
        />
      </section>

      {/* Generated Study Notes Section with Delete & Export */}
      <StudyNotesView studyNotes={course.studyNotes} />

      {course.studyNotes.length > 0 && (
        <ChatWithAiTutorButton courseId={course.id} />
      )}
    </div>
  );
}
