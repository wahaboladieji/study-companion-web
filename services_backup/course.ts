import { prisma } from "@/lib/prisma";
import { objectStorage } from "@/lib/storage/object-storage";
import { assertUsageAllowed, UsageLimitError } from "@/services/usage";
import { createCourseSchema, formatCourseZodError, type CreateCourseInput } from "@/lib/validations/course";
import { listCourseFiles, type CourseFileSummary } from "@/services/upload";
import type { Course } from "@prisma/client";

export type CourseDetail = {
  id: string;
  name: string;
  createdAt: string;
  files: CourseFileSummary[];
};

export async function getCourseDetail(
  userId: string,
  courseId: string
): Promise<CourseDetail | null> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: { id: true, name: true, createdAt: true },
  });

  if (!course) {
    return null;
  }

  const files = await listCourseFiles(userId, course.id);

  return {
    id: course.id,
    name: course.name,
    createdAt: course.createdAt.toISOString(),
    files,
  };
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

  return { success: true };
}
