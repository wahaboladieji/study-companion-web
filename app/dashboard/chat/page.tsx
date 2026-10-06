import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CourseChatView } from "@/components/dashboard/course-chat-view";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?mode=signin");
  }

  const cookieStore = await cookies();
  const cookieCourseId = cookieStore.get("chat-course")?.value;

  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      files: { select: { processingStatus: true } },
      studyNotes: { select: { id: true } },
    },
  });

  if (courses.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-[var(--spacing-800)]">
        <div className="flex flex-col items-center text-center max-w-md space-y-[var(--spacing-300)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
            <BookOpen className="h-8 w-8" />
          </div>
          <div className="space-y-[var(--spacing-100)]">
            <h1 className="text-headline-small text-on-surface">AI Tutor</h1>
            <p className="text-body-medium text-on-surface-variant">
              Create a course and upload your study materials to start chatting
              with your AI Tutor.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-[var(--spacing-100)] rounded-md bg-primary px-[var(--spacing-300)] py-[var(--spacing-150)] text-label-medium text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Go to courses
          </Link>
        </div>
      </div>
    );
  }

  const selected =
    courses.find((course) => course.id === cookieCourseId) ??
    courses.find((course) => course.studyNotes.length > 0) ??
    courses[0];

  const hasReadyContent =
    selected.files.some((file) => file.processingStatus === "READY") ||
    selected.studyNotes.length > 0;

  return (
    <CourseChatView
      key={selected.id}
      courseId={selected.id}
      hasReadyContent={hasReadyContent}
      courses={courses.map((course) => ({ id: course.id, name: course.name }))}
    />
  );
}