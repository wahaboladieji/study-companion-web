"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/services/auth";
import { validateCsrfToken } from "@/services/csrf";
import { uploadCourseFile, listCourseFiles, type UploadedFileResult } from "@/services/upload";

export type UploadNotesFormState = {
  error?: string;
  files?: UploadedFileResult[];
} | null;

export type CourseFileSummary = {
  id: string;
  fileName: string;
  fileSize: number;
  processingStatus: string;
  createdAt: string;
};

const CSRF_FAILURE = "Security check failed. Please refresh the page and try again.";
const AUTH_FAILURE = "You must be signed in to upload files.";

export async function uploadNotesAction(
  prevState: UploadNotesFormState,
  formData: FormData
): Promise<UploadNotesFormState> {
  if (!(await validateCsrfToken(formData.get("csrfToken") as string | null))) {
    return { error: CSRF_FAILURE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: AUTH_FAILURE };
  }

  const courseId = formData.get("courseId") as string | null;
  if (!courseId) {
    return { error: "Select a course before uploading files." };
  }

  const entries = formData.getAll("files");
  const uploadedFiles: UploadedFileResult[] = [];

  for (const entry of entries) {
    if (!(entry instanceof File)) {
      continue;
    }

    const bytes = new Uint8Array(await entry.arrayBuffer());

    const result = await uploadCourseFile({
      userId: user.id,
      courseId,
      fileName: entry.name,
      mimeType: entry.type,
      size: entry.size,
      bytes,
    });

    uploadedFiles.push(result);
  }

  if (uploadedFiles.length === 0) {
    return { error: "No files were selected to upload." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/course/${courseId}`);

  return { files: uploadedFiles };
}

export async function getCourseFilesAction(courseId: string): Promise<CourseFileSummary[]> {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  return listCourseFiles(user.id, courseId);
}
