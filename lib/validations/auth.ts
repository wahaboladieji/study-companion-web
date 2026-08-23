import { z } from "zod";

/**
 * Shared password rules – mirrors the client-side checklist in the sign-up
 * form so the server never accepts a password the UI would have rejected.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[#@>^]/, "Password must contain a special character (#@>^)");

/**
 * Full-name rule – at least two words, letters only.
 */
const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .regex(/^[a-zA-Z\s]+$/, "Name must use only letters")
  .refine(
    (value) => value.split(/\s+/).length >= 2,
    { message: "Name must be at least 2 words" },
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address");

// ─── Exported schemas ────────────────────────────────────────────────

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

const resetCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Enter the 5-digit code");

export const requestResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: resetCodeSchema,
  password: passwordSchema,
});

// ─── Types ───────────────────────────────────────────────────────────

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type RequestResetInput = z.infer<typeof requestResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Formats a ZodError into a single user-facing string by joining all
 * issue messages. Returns the first issue message for brevity.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Validation failed";
}
