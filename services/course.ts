import { prisma } from "@/lib/prisma";
import { objectStorage } from "@/lib/storage/object-storage";
import { assertUsageAllowed, UsageLimitError, invalidateUserUsageCache } from "@/services/usage";
import { createCourseSchema, formatCourseZodError, type CreateCourseInput } from "@/lib/validations/course";
import { listCourseFiles, type CourseFileSummary } from "@/services/upload";
import type { Course } from "@prisma/client";
import { cacheService } from "@/lib/cache/cache-service";

export type StudyNoteSummary = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CourseDetail = {
  id: string;
  name: string;
  createdAt: string;
  files: CourseFileSummary[];
  studyNotes: StudyNoteSummary[];
};

export async function invalidateCourseCache(courseId: string): Promise<void> {
  await cacheService.del(`course:detail:${courseId}`);
}

export async function getCourseDetail(
  userId: string,
  courseId: string
): Promise<CourseDetail | null> {
  const cacheKey = `course:detail:${courseId}`;
  const cached = await cacheService.get<CourseDetail>(cacheKey);
  if (cached) {
    return cached;
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      studyNotes: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!course) {
    return null;
  }

  const files = await listCourseFiles(userId, course.id);

  const detail: CourseDetail = {
    id: course.id,
    name: course.name,
    createdAt: course.createdAt.toISOString(),
    files,
    studyNotes: course.studyNotes.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
  };

  await cacheService.set(cacheKey, detail, 600); // 10 minutes TTL
  return detail;
}

interface CreateCourseResult {
  success: boolean;
  error?: string;
  course?: Course;
}

export async function createCourse(
  input: CreateCourseInput,
  userId: string
): Promise<CreateCourseResult> {
  // Validate input
  const parsed = createCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: formatCourseZodError(parsed.error) };
  }
  
  const { name } = parsed.data;

  try {
    // Assert usage limits before doing expensive database operations
    const allowance = await assertUsageAllowed({
      userId,
      type: "COURSE",
      requestedQuantity: 1,
    });

    // Execute in a transaction to ensure UsageEvent is written successfully
    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          name,
          userId,
        },
      });

      // Record successful usage
      await tx.usageEvent.create({
        data: {
          userId,
          courseId: course.id,
          eventType: "COURSE_CREATED",
          quantity: 1,
          billingPeriod: allowance.billingPeriod,
        },
      });

      return course;
    });

    await invalidateUserUsageCache(userId);

    return {
      success: true,
      course: result,
    };
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return { success: false, error: "You have reached the maximum number of courses for your plan. Please upgrade to create more." };
    }
    
    // Log unexpected errors safely
    console.error("[CourseService] Failed to create course:", error instanceof Error ? error.message : "Unknown error");
    return { success: false, error: "An unexpected error occurred while creating the course. Please try again." };
  }
}

export type CourseProcessingStatus = {
  allReady: boolean;
  hasStudyNote: boolean;
};

/**
 * Lightweight check used by the ProcessingStatusBanner to decide
 * when all files are READY *and* a study note has been generated.
 */
export async function getCourseProcessingStatus(
  userId: string,
  courseId: string
): Promise<CourseProcessingStatus> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: {
      id: true,
      files: {
        select: { processingStatus: true },
      },
      studyNotes: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!course) {
    return { allReady: true, hasStudyNote: false };
  }

  const allReady =
    course.files.length > 0 &&
    course.files.every((f) => f.processingStatus === "READY" || f.processingStatus === "FAILED");

  return {
    allReady,
    hasStudyNote: course.studyNotes.length > 0,
  };
}

export async function deleteCourse(
  courseId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: {
      id: true,
      files: { select: { storageKey: true } },
    },
  });

  if (!course) {
    return { success: false, error: "Course not found." };
  }

  const storageKeys = course.files.map((f) => f.storageKey);

  await prisma.course.delete({ where: { id: course.id } });

  await Promise.allSettled(
    storageKeys.map((key) => objectStorage.delete(key))
  );

  await invalidateCourseCache(courseId);
  await invalidateUserUsageCache(userId);

  return { success: true };
}

