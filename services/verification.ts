import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createUniqueJob } from "@/services/background-jobs";
import { triggerBackgroundWorker } from "@/services/background-jobs-worker";

export function derive5DigitCode(token: string): string {
  // Deterministically derive a 5-digit number (10000 - 99999) from the 64-character token
  const parsed = parseInt(token.substring(0, 8), 16);
  return ((parsed % 90000) + 10000).toString();
}

const CODE_VALIDITY_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Generates a verification code and stores it temporarily in the EmailVerified
 * table with an expiration time (24 hours). Replaces any prior code.
 */
export async function generateVerificationCode(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CODE_VALIDITY_MS);

  await prisma.emailVerified.upsert({
    where: { userId },
    create: {
      userId,
      code: token,
      codeExpiresAt: expiresAt,
    },
    update: {
      code: token,
      codeExpiresAt: expiresAt,
    },
  });

  return token;
}

/**
 * Enqueues a background job to send the verification email to the user.
 */
export async function enqueueVerificationEmail(userId: string) {
  await createUniqueJob({
    type: "SEND_VERIFICATION_EMAIL",
    deduplicationKey: `verify_email_${userId}_${Date.now()}`,
    payload: { userId },
  });

  // Trigger worker asynchronously to run immediately in the background
  triggerBackgroundWorker();
}

/**
 * Enqueues a background job to send the welcome email to the user.
 */
export async function enqueueWelcomeEmail(userId: string) {
  await createUniqueJob({
    type: "SEND_WELCOME_EMAIL",
    deduplicationKey: `welcome_email_${userId}`,
    payload: { userId },
  });

  triggerBackgroundWorker();
}

/**
 * Verifies a user's email using the provided code.
 * On success the temporary EmailVerified record is deleted.
 */
export async function verifyEmail(userId: string, code: string) {
  const verification = await prisma.emailVerified.findUnique({
    where: { userId },
  });

  if (!verification) {
    return { success: false, error: "No verification code set" };
  }

  const expectedCode = derive5DigitCode(verification.code);
  if (expectedCode !== code) {
    return { success: false, error: "Invalid verification code" };
  }

  if (verification.codeExpiresAt < new Date()) {
    return { success: false, error: "Verification code has expired" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerified.delete({
      where: { userId },
    }),
  ]);

  return { success: true };
}

