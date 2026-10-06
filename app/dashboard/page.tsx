import { ConfettiCelebration } from "@/components/dashboard/confetti-celebration";
import { Plus } from "lucide-react";
import { Book } from "reicon-react/icons/Book";
import { CreateCourseDialog } from "@/components/dashboard/create-course-dialog";
import { UploadNotesDialog } from "@/components/dashboard/upload-notes-dialog";
import { CourseCard } from "@/components/dashboard/course-card";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { celebrate } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?mode=signin");
  }

  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { files: true } },
    },
  });

  const courseOptions = courses.map((course) => ({
    id: course.id,
    name: course.name,
  }));

  return (
    <div className="space-y-[var(--spacing-600)]">
      {celebrate === "1" && <ConfettiCelebration />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[var(--spacing-200)]">
        <div>
          <h1 className="text-headline-small font-semibold text-on-surface">Courses</h1>
          <p className="text-body-medium text-outline">
            Manage your study spaces and materials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[var(--spacing-200)]">
          <UploadNotesDialog
            courses={courseOptions}
            triggerVariant="ghost"
            triggerClassName="border border-outline-variant gap-[var(--spacing-75)] pl-[var(--spacing-150)]"
          />
          <CreateCourseDialog 
            triggerClassName="shrink-0 gap-[var(--spacing-75)] pl-[var(--spacing-150)]"
            triggerContent={
              <>
                <Plus className="h-4 w-4" />
                New Course
              </>
            }
          />
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-outline border-dashed bg-surface-lowest p-[var(--spacing-800)] text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container-light text-on-primary-container mb-[var(--spacing-200)]">
            <Book className="h-6 w-6" />
          </div>
          <h3 className="text-title-large font-semibold text-on-surface">No courses</h3>
          <p className="mt-[var(--spacing-50)] text-body-medium text-outline max-w-sm">
            Get started by creating a new course.
          </p>
          <div className="mt-[var(--spacing-400)]">
            <CreateCourseDialog 
              triggerContent="Create New Course"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-400)]">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={{
                id: course.id,
                name: course.name,
                createdAt: course.createdAt,
                fileCount: course._count.files,
              }}
              courseOptions={courseOptions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
