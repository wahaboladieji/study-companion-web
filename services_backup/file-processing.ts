import type { Prisma } from "@prisma/client";

export interface ProcessFilePayload {
  fileId: string;
}

export function processFileDeduplicationKey(fileId: string): string {
  return `process_file_${fileId}`;
}

/**
 * Creates the PROCESS_FILE background job for a freshly uploaded file.
 * Idempotent: a single job per file regardless of how often this is called.
 */
export async function enqueueProcessFile(
  tx: Prisma.TransactionClient,
  fileId: string
) {
  return tx.backgroundJob.upsert({
    where: {
      deduplicationKey: processFileDeduplicationKey(fileId),
    },
    create: {
      type: "PROCESS_FILE",
      deduplicationKey: processFileDeduplicationKey(fileId),
      payload: { fileId },
      status: "PENDING",
      attemptCount: 0,
      maximumAttempts: 3,
      scheduledAt: new Date(),
    },
    update: {},
  });
}
