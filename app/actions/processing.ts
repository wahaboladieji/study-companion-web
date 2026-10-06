"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/services/auth";
import { validateCsrfToken } from "@/services/csrf";
import { prisma } from "@/lib/prisma";
import { processFileDeduplicationKey } from "@/services/file-processing";
import { triggerBackgroundWorker } from "@/services/background-jobs-worker";
import { invalidateCourseCache } from "@/services/course";
import {
  assertRateLimit,
  RateLimitError,
  RATE_LIMIT_MESSAGE,
  RATE_LIMITS,
} from "@/services/rate-limit";

export type StartProcessingFormState = {
  queued?: number;
  error?: string;
} | null;

const CSRF_FAILURE = "Security check failed. Please refresh the page and try again.";
const AUTH_FAILURE = "You must be signed in to process files.";

/**
 * Re-enqueues PROCESS_FILE background jobs for all files in a course
 * that are currently UPLOADED or FAILED, then kicks the worker.
 *
 * Idempotent: calling this multiple times is safe — existing PENDING jobs
 * are reset, already-READY files are skipped.
 */
export async function startProcessingAction(
  prevState: StartProcessingFormState,
  formData: FormData
): Promise<StartProcessingFormState> {
  if (!(await validateCsrfToken(formData.get("csrfToken") as string | null))) {
    return { error: CSRF_FAILURE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: AUTH_FAILURE };
  }

  const courseId = formData.get("courseId") as string | null;
  if (!courseId) {
    return { error: "Course ID is required." };
  }

  // Verify the user owns this course
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: user.id },
    select: { id: true },
  });

  if (!course) {
    return { error: "Course not found." };
  }

  // Rate-limit: 10 processing triggers per user per 15 minutes
  try {
    await assertRateLimit({
      ...RATE_LIMITS.START_PROCESSING,
      key: `user:${user.id}`,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: RATE_LIMIT_MESSAGE };
    }
    throw error;
  }

  // Find all files in the course to process
  const processableFiles = await prisma.file.findMany({
    where: {
      courseId: course.id,
    },
    select: { id: true },
  });

  if (processableFiles.length === 0) {
    return { queued: 0 };
  }

  // Upsert a PROCESS_FILE job for each file — reset to PENDING if it exists
  await Promise.all(
    processableFiles.map((file) =>
      prisma.backgroundJob.upsert({
        where: { deduplicationKey: processFileDeduplicationKey(file.id) },
        create: {
          type: "PROCESS_FILE",
          deduplicationKey: processFileDeduplicationKey(file.id),
          payload: { fileId: file.id },
          status: "PENDING",
          attemptCount: 0,
          maximumAttempts: 3,
          scheduledAt: new Date(),
        },
        update: {
          status: "PENDING",
          attemptCount: 0,
          scheduledAt: new Date(),
          errorMessage: null,
        },
      })
    )
  );

  // Update file statuses to PROCESSING so the worker processes them and UI reflects active state
  await prisma.file.updateMany({
    where: {
      id: { in: processableFiles.map((f) => f.id) },
    },
    data: { processingStatus: "PROCESSING", processingError: null },
  });

  // Invalidate cached course detail so the re-render sees PROCESSING status
  await invalidateCourseCache(courseId);

  // Kick the background worker
  triggerBackgroundWorker();

  revalidatePath(`/dashboard/course/${courseId}`);

  return { queued: processableFiles.length };
}
