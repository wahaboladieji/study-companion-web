import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { objectStorage } from "@/lib/storage/object-storage";
import { assertUsageAllowed, UsageLimitError, getCurrentBillingPeriod } from "@/services/usage";
import { enqueueProcessFile } from "@/services/file-processing";
import { triggerBackgroundWorker } from "@/services/background-jobs-worker";
import {
  validateUploadFile,
  sanitizeFileName,
  type UploadValidationResult,
} from "@/lib/validations/upload";

export type UploadedFileResult = {
  id?: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  processingStatus?: string;
  duplicate: boolean;
  error?: string;
};

export type CourseFileSummary = {
  id: string;
  fileName: string;
  fileSize: number;
  processingStatus: string;
  createdAt: string;
};

export async function listCourseFiles(
  userId: string,
  courseId: string
): Promise<CourseFileSummary[]> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId },
    select: { id: true },
  });

  if (!course) {
    return [];
  }

  const files = await prisma.file.findMany({
    where: { courseId: course.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      processingStatus: true,
      createdAt: true,
    },
  });

  return files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    processingStatus: file.processingStatus,
    createdAt: file.createdAt.toISOString(),
  }));
}

export async function uploadCourseFile(input: {
  userId: string;
  courseId: string;
  fileName: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
}): Promise<UploadedFileResult> {
  const safeFileName = sanitizeFileName(input.fileName);

  const validation: UploadValidationResult = validateUploadFile(
    safeFileName,
    input.mimeType,
    input.size
  );

  if (!validation.ok) {
    return { fileName: safeFileName, duplicate: false, error: validation.error };
  }

  const course = await prisma.course.findFirst({
    where: {
      id: input.courseId,
      userId: input.userId,
    },
    select: { id: true },
  });

  if (!course) {
    return { fileName: safeFileName, duplicate: false, error: "Course not found." };
  }

  const duplicateName = await prisma.file.findFirst({
    where: {
      courseId: course.id,
      fileName: safeFileName,
    },
    select: { id: true },
  });

  try {
    await assertUsageAllowed({
      userId: input.userId,
      type: "UPLOAD",
      requestedQuantity: 1,
    });

    await assertUsageAllowed({
      userId: input.userId,
      type: "STORAGE",
      requestedQuantity: input.size,
    });
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return {
        fileName: safeFileName,
        duplicate: Boolean(duplicateName),
        error:
          error.limitType === "STORAGE"
            ? "You have reached your storage limit for this plan. Delete files or upgrade to upload more."
            : "You have reached the upload limit for your plan. Upgrade to upload more files.",
      };
    }
    throw error;
  }

  const storageKey = `courses/${course.id}/${randomUUID()}`;

  try {
    await objectStorage.put({
      key: storageKey,
      body: input.bytes,
      contentType: validation.fileType,
    });
  } catch (error) {
    console.error(
      "[UploadService] Object storage failed for file:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return {
      fileName: safeFileName,
      duplicate: Boolean(duplicateName),
      error: "The file could not be stored. Please try again.",
    };
  }

  try {
    const file = await prisma.$transaction(async (tx) => {
      const created = await tx.file.create({
        data: {
          courseId: course.id,
          fileName: safeFileName,
          fileType: validation.fileType,
          fileSize: input.size,
          storageKey,
          processingStatus: "UPLOADED",
          retryCount: 0,
        },
      });

      await tx.usageEvent.createMany({
        data: [
          {
            userId: input.userId,
            courseId: course.id,
            eventType: "FILE_UPLOADED",
            quantity: 1,
            billingPeriod: getCurrentBillingPeriod(),
          },
          {
            userId: input.userId,
            courseId: course.id,
            eventType: "STORAGE_USED",
            quantity: input.size,
            billingPeriod: getCurrentBillingPeriod(),
          },
        ],
      });

      await enqueueProcessFile(tx, created.id);

      await tx.course.update({
        where: { id: course.id },
        data: { updatedAt: new Date() },
      });

      return created;
    });

    triggerBackgroundWorker();

    return {
      id: file.id,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      processingStatus: file.processingStatus,
      duplicate: Boolean(duplicateName),
    };
  } catch (error) {
    console.error(
      "[UploadService] Metadata creation failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    await objectStorage.delete(storageKey).catch(() => undefined);
    return {
      fileName: safeFileName,
      duplicate: Boolean(duplicateName),
      error: "The upload could not be finalized. Please try again.",
    };
  }
}
