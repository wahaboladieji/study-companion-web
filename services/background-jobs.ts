import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BackgroundJobType } from "@prisma/client";

// Define the shape of our payload for SEND_VERIFICATION_EMAIL
export interface SendVerificationEmailPayload {
  userId: string;
}

export interface SendWelcomeEmailPayload {
  userId: string;
}

export interface SendPasswordResetEmailPayload {
  userId: string;
}

/**
 * Creates a unique background job. If a job with the same type and deduplicationKey
 * already exists, it is not duplicated.
 */
export async function createUniqueJob(input: {
  type: BackgroundJobType;
  deduplicationKey: string;
  payload: Prisma.InputJsonValue;
}) {
  return prisma.backgroundJob.upsert({
    where: {
      deduplicationKey: input.deduplicationKey, // Using the unique constraint
    },
    create: {
      type: input.type,
      deduplicationKey: input.deduplicationKey,
      payload: input.payload,
      status: "PENDING",
      attemptCount: 0,
      maximumAttempts: 3,
      scheduledAt: new Date(),
    },
    update: {
      // If it exists but failed previously, we might want to retry it.
      // For this simple implementation, if it already exists, we do nothing or reset to PENDING if failed.
      status: "PENDING",
      attemptCount: 0,
      scheduledAt: new Date(),
    },
  });
}
