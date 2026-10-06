import crypto from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { derive5DigitCode } from "@/services/verification";
import { createUniqueJob } from "@/services/background-jobs";
import { triggerBackgroundWorker } from "@/services/background-jobs-worker";
import {
  requestResetSchema,
  resetPasswordSchema,
  formatZodError,
} from "@/lib/validations/auth";
import {
  assertRateLimit,
  getClientIp,
  RateLimitError,
  RATE_LIMIT_MESSAGE,
  RATE_LIMITS,
} from "@/services/rate-limit";

const SALT_ROUNDS = 12;
const RESET_CODE_VALIDITY_MS = 15 * 60 * 1000; // 15 minutes

interface PasswordResetResult {
  success: boolean;
  error?: string;
}

/**
 * Generates a password reset code and stores it in the PasswordReset table.
 * Replaces any prior code. The 5-digit code is derived deterministically from
 * the stored token, matching the email-verification pattern.
 */
export async function generatePasswordResetCode(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_CODE_VALIDITY_MS);

  await prisma.passwordReset.upsert({
    where: { userId },
    create: {
      userId,
      token,
      expiresAt,
    },
    update: {
      token,
      expiresAt,
    },
  });

  return token;
}

/**
 * Enqueues a background job to email the reset code to the user.
 */
export async function enqueuePasswordResetEmail(userId: string) {
  await createUniqueJob({
    type: "SEND_PASSWORD_RESET_EMAIL",
    deduplicationKey: `password_reset_${userId}_${Date.now()}`,
    payload: { userId },
  });

  triggerBackgroundWorker();
}

/**
 * Starts a password reset for the given email.
 *
 * Always reports success whether or not the account exists, so the endpoint
 * cannot be used to enumerate registered emails.
 */
export async function requestPasswordReset(input: {
  email: string;
}): Promise<PasswordResetResult> {
  const parsed = requestResetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }

  const ip = await getClientIp();
  try {
    await assertRateLimit({
      ...RATE_LIMITS.PASSWORD_RESET_REQUEST,
      key: `ip:${ip}`,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { success: false, error: RATE_LIMIT_MESSAGE };
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (user) {
    await generatePasswordResetCode(user.id);
    await enqueuePasswordResetEmail(user.id);
  }

  return { success: true };
}

/**
 * Verifies the reset code for the account and sets a new password.
 * Consumes the code on success so it cannot be reused.
 */
export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<PasswordResetResult> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }

  const { email, code, password } = parsed.data;

  try {
    await assertRateLimit({
      ...RATE_LIMITS.PASSWORD_RESET_SUBMIT,
      key: `user:${email}`,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { success: false, error: RATE_LIMIT_MESSAGE };
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.passwordHash) {
    return { success: false, error: "Invalid or expired reset code" };
  }

  const reset = await prisma.passwordReset.findUnique({
    where: { userId: user.id },
  });

  if (!reset) {
    return { success: false, error: "Invalid or expired reset code" };
  }

  if (derive5DigitCode(reset.token) !== code) {
    return { success: false, error: "Invalid or expired reset code" };
  }

  if (reset.expiresAt < new Date()) {
    return { success: false, error: "Invalid or expired reset code" };
  }

  const passwordHash = await hash(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.passwordReset.delete({
      where: { userId: user.id },
    }),
  ]);

  return { success: true };
}
