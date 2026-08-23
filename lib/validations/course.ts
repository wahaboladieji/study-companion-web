import { z } from "zod";

export const courseNameSchema = z
  .string()
  .trim()
  .min(1, "Course name is required")
  .max(100, "Course name cannot exceed 100 characters");

export const createCourseSchema = z.object({
  name: courseNameSchema,
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

/**
 * Formats a ZodError into a single user-facing string by joining all
 * issue messages. Returns the first issue message for brevity.
 */
export function formatCourseZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Validation failed";
}
