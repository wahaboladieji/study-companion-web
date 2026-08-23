import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  FileText,
  MessageCircle,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { getCurrentUser } from "@/services/auth";
import { getCourseDetail } from "@/services/course";
import { UploadNotesDialog } from "@/components/dashboard/upload-notes-dialog";
import { FileStatusBadge } from "@/components/dashboard/file-status-badge";
import { formatFileSize } from "@/lib/validations/upload";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const AI_TOOLS = [
  {
    icon: BookOpen,
    title: "AI Study Notes",
    description:
      "Summarize your uploaded materials into organized, easy-to-review study notes.",
  },
  {
    icon: Sparkles,
    title: "AI Flashcards",
    description:
      "Turn key concepts from your materials into question-and-answer cards.",
  },
  {
    icon: MessageCircle,
    title: "Course Chat",
    description:
      "Ask questions and get answers grounded only in your uploaded materials.",
  },
];

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

  const hasReadyFiles = course.files.some(
    (file) => file.processingStatus === "READY"
  );

  return (
    <div className="space-y-[var(--spacing-600)]">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-[var(--spacing-100)] rounded-sm text-label-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to courses
      </Link>

      <div className="flex flex-col gap-[var(--spacing-300)] sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-[var(--spacing-300)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container-light text-on-primary-container">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>
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
        </div>
        <UploadNotesDialog
          courses={[{ id: course.id, name: course.name }]}
          defaultCourseId={course.id}
          triggerContent={
            <>
              <UploadCloud className="h-4 w-4" />
              Upload files
            </>
          }
        />
      </div>

      <section aria-labelledby="course-files-heading" className="space-y-[var(--spacing-300)]">
        <div className="flex items-center justify-between">
          <h2 id="course-files-heading" className="text-title-large font-semibold text-on-surface">
            Files
          </h2>
          <p className="text-body-small text-on-surface-variant">
            {course.files.length}{" "}
            {course.files.length === 1 ? "file" : "files"}
          </p>
        </div>

        {course.files.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline bg-surface-lowest p-[var(--spacing-600)] text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container-light text-on-primary-container mb-[var(--spacing-200)]">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-title-medium font-semibold text-on-surface">
              No files yet
            </h3>
            <p className="mt-[var(--spacing-50)] max-w-sm text-body-medium text-on-surface-variant">
              Upload your handwritten notes and study materials so AI can
              transcribe and organize them.
            </p>
          </div>
        ) : (
          <ul className="space-y-[var(--spacing-100)]">
            {course.files.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-[var(--spacing-200)] rounded-lg border border-surface-container-high bg-surface-lowest p-[var(--spacing-300)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container-light text-on-primary-container">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-medium text-on-surface">
                    {file.fileName}
                  </p>
                  <p className="mt-[var(--spacing-25)] text-body-small text-on-surface-variant">
                    {formatFileSize(file.fileSize)} &middot;{" "}
                    {new Date(file.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <FileStatusBadge status={file.processingStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ai-tools-heading" className="space-y-[var(--spacing-300)]">
        <div>
          <h2 id="ai-tools-heading" className="text-title-large font-semibold text-on-surface">
            AI Study Tools
          </h2>
          <p className="mt-[var(--spacing-25)] text-body-small text-on-surface-variant">
            {hasReadyFiles
              ? "Your processed files can power these tools. They are generated on demand."
              : "These tools unlock once at least one file has finished processing."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[var(--spacing-300)] sm:grid-cols-2 lg:grid-cols-3">
          {AI_TOOLS.map((tool) => (
            <div
              key={tool.title}
              className="flex flex-col rounded-xl border border-surface-container-high bg-surface-lowest p-[var(--spacing-400)] shadow-soft"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container-light text-on-primary-container">
                <tool.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-[var(--spacing-200)] text-title-medium font-medium text-on-surface">
                {tool.title}
              </h3>
              <p className="mt-[var(--spacing-50)] flex-1 text-body-small text-on-surface-variant">
                {tool.description}
              </p>
              <p className="mt-[var(--spacing-200)] text-label-medium text-primary">
                {hasReadyFiles ? (
                  <span className="inline-flex items-center gap-[var(--spacing-50)]">
                    Available
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : (
                  "Waiting for processed files"
                )}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
