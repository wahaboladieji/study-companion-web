import { prisma } from "@/lib/prisma";
import { BackgroundJob } from "@prisma/client";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from "@/services/email";
import { SendVerificationEmailPayload, SendWelcomeEmailPayload, SendPasswordResetEmailPayload } from "@/services/background-jobs";
import { derive5DigitCode } from "@/services/verification";
import { ProcessFilePayload } from "@/services/file-processing";
import { processFileContent } from "@/services/document-processor";

export async function processProcessFile(job: BackgroundJob) {
  const payload = job.payload as unknown as ProcessFilePayload;

  if (!payload || !payload.fileId) {
    throw new Error("Invalid payload: missing fileId");
  }

  try {
    await processFileContent(payload.fileId);
  } catch (err) {
    // Record the error on the file record so the UI can display it
    const errorMessage =
      err instanceof Error ? err.message : "An unexpected error occurred during processing.";
    await prisma.file
      .update({
        where: { id: payload.fileId },
        data: { processingStatus: "FAILED", processingError: errorMessage },
      })
      .catch(() => {
        // Best-effort — don't mask the original error
      });
    throw err;
  }
}

export async function processSendPasswordResetEmail(job: BackgroundJob) {
  const payload = job.payload as unknown as SendPasswordResetEmailPayload;

  if (!payload || !payload.userId) {
    throw new Error("Invalid payload: missing userId");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    // User deleted, nothing to do. Complete job gracefully.
    return;
  }

  const reset = await prisma.passwordReset.findUnique({
    where: { userId: user.id },
  });

  if (!reset) {
    throw new Error("User has no password reset code set");
  }

  if (reset.expiresAt < new Date()) {
    // Expired code, nothing meaningful to send. Complete the job gracefully.
    return;
  }

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    code: derive5DigitCode(reset.token),
  });
}

export async function processSendWelcomeEmail(job: BackgroundJob) {
  const payload = job.payload as unknown as SendWelcomeEmailPayload;
  
  if (!payload || !payload.userId) {
    throw new Error("Invalid payload: missing userId");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    return;
  }

  await sendWelcomeEmail({
    to: user.email,
    name: user.name,
  });
}

export async function processSendVerificationEmail(job: BackgroundJob) {
  const payload = job.payload as unknown as SendVerificationEmailPayload;
  
  if (!payload || !payload.userId) {
    throw new Error("Invalid payload: missing userId");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    // User deleted, nothing to do. Complete job gracefully.
    return;
  }

  if (user.emailVerified) {
    // Already verified.
    return;
  }

  const verification = await prisma.emailVerified.findUnique({
    where: { userId: user.id },
  });

  if (!verification) {
    throw new Error("User has no verification code set");
  }



  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    code: derive5DigitCode(verification.code),
  });
}

/**
 * Atomically claims the next pending job whose scheduledAt time has arrived.
 */
async function claimNextJobAtomically() {
  // Use a transaction and SKIP LOCKED to safely claim one row for PostgreSQL
  return await prisma.$transaction(async (tx) => {
    const jobs = await tx.$queryRaw<BackgroundJob[]>`
      SELECT * FROM "BackgroundJob"
      WHERE status = 'PENDING' AND "scheduledAt" <= NOW()
      ORDER BY "scheduledAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    if (jobs.length === 0) {
      return null;
    }

    const job = jobs[0];

    const updated = await tx.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
      },
    });

    return updated;
  });
}

/**
 * Helper to determine if an error is permanent or retryable.
 */
function isPermanentJobError(error: unknown): boolean {
  // For simplicity, treat missing payloads or user data issues as permanent,
  // and network/SMTP errors (which usually throw generic errors) as retryable.
  const msg = (error as Error)?.message || "";
  if (msg.includes("Invalid payload") || msg.includes("no verification code") || msg.includes("no password reset code")) {
    return true;
  }
  return false;
}

export async function runNextJob() {
  const job = await claimNextJobAtomically();

  if (!job) {
    return;
  }

  try {
    if (job.type === "SEND_VERIFICATION_EMAIL") {
      await processSendVerificationEmail(job);
    } else if (job.type === "SEND_WELCOME_EMAIL") {
      await processSendWelcomeEmail(job);
    } else if (job.type === "SEND_PASSWORD_RESET_EMAIL") {
      await processSendPasswordResetEmail(job);
    } else if (job.type === "PROCESS_FILE") {
      await processProcessFile(job);
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    // Drain: if more pending jobs exist, process the next one
    triggerBackgroundWorker();
  } catch (error: unknown) {
    const errorMessage = (error as Error)?.message || "Unknown error";
    
    if (isPermanentJobError(error) || job.attemptCount + 1 >= job.maximumAttempts) {
      // Fail permanently
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage,
          attemptCount: job.attemptCount + 1,
        },
      });
      return;
    }

    // Recoverable failure, retry later (e.g. 5 minutes from now)
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        errorMessage,
        attemptCount: job.attemptCount + 1,
        scheduledAt: new Date(Date.now() + 5 * 60 * 1000), 
      },
    });

    // Continue draining other pending jobs
    triggerBackgroundWorker();
  }
}

/**
 * Triggers processing for a single job asynchronously.
 * Useful to call after enqueuing a job so it starts immediately without waiting for a cron.
 */
export function triggerBackgroundWorker() {
  runNextJob().catch((err) => {
    console.error("Background worker error:", err);
  });
}
