"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/services/auth";
import { validateCsrfToken } from "@/services/csrf";
import { prisma } from "@/lib/prisma";

export type DeleteStudyNoteState = {
  success?: boolean;
  error?: string;
} | null;

/**
 * Server action to delete a generated StudyNote record.
 * Authenticates user, verifies course ownership, and deletes note.
 */
export async function deleteStudyNoteAction(
  prevState: DeleteStudyNoteState,
  formData: FormData
): Promise<DeleteStudyNoteState> {
  const csrfToken = formData.get("csrfToken") as string | null;
  if (!(await validateCsrfToken(csrfToken))) {
    return { error: "Security check failed. Please refresh and try again." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in to delete study notes." };
  }

  const noteId = formData.get("noteId") as string | null;
  const courseId = formData.get("courseId") as string | null;

  if (!noteId || !courseId) {
    return { error: "Missing required parameters." };
  }

  // Verify ownership of the course associated with this note
  const note = await prisma.studyNote.findFirst({
    where: {
      id: noteId,
      course: {
        userId: user.id,
      },
    },
    select: { id: true },
  });

  if (!note) {
    return { error: "Study Note not found or permission denied." };
  }

  await prisma.studyNote.delete({
    where: { id: note.id },
  });

  revalidatePath(`/dashboard/course/${courseId}`);

  return { success: true };
}
