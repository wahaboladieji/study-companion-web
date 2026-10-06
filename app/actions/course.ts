"use server";

import { createCourse, deleteCourse } from "@/services/course";
import { getCurrentUser } from "@/services/auth";
import { validateCsrfToken } from "@/services/csrf";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateCourseFormState = {
  error?: string;
  success?: boolean;
  courseId?: string;
} | null;

const CSRF_FAILURE = "Security check failed. Please refresh the page and try again.";
const AUTH_FAILURE = "You must be signed in to create a course.";

export async function createCourseAction(
  prevState: CreateCourseFormState,
  formData: FormData
): Promise<CreateCourseFormState> {
  if (!(await validateCsrfToken(formData.get("csrfToken") as string | null))) {
    return { error: CSRF_FAILURE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: AUTH_FAILURE };
  }

  const name = formData.get("name") as string;

  const result = await createCourse({ name }, user.id);
  
  if (!result.success) {
    return { error: result.error };
  }

  // Refresh the dashboard to show the new course
  revalidatePath("/dashboard");

  return { success: true, courseId: result.course?.id };
}

export type DeleteCourseFormState = {
  error?: string;
  success?: boolean;
} | null;

export async function deleteCourseAction(
  prevState: DeleteCourseFormState,
  formData: FormData
): Promise<DeleteCourseFormState> {
  if (!(await validateCsrfToken(formData.get("csrfToken") as string | null))) {
    return { error: CSRF_FAILURE };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: AUTH_FAILURE };
  }

  const courseId = formData.get("courseId") as string;
  if (!courseId) {
    return { error: "Course ID is required." };
  }

  const result = await deleteCourse(courseId, user.id);

  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
