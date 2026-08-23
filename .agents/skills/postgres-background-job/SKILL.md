---
name: postgres-background-job
description: Use when adding or changing a PostgreSQL-backed background job, worker, retryable task, OCR worker, extraction worker, AI generation worker, embedding worker, deletion cleanup worker, scheduled retry, job claiming, or failure recovery. Trigger words include BackgroundJob, worker, queue, retry, scheduledAt, claim job, idempotent job, PROCESSING, FAILED, and maximum attempts.
---

# PostgreSQL Background Job

This skill teaches the lifecycle for reliable PostgreSQL-backed jobs.

The governing laws are in:

- `.agents/rules/database-schema.md`
- `.agents/rules/uploads-and-storage.md`
- `.agents/rules/ai-pipeline.md`
- `.agents/rules/coding-standards.md`

## Procedure

1. Define one clear job type.
   - Use an approved enum.
   - Keep the payload minimal.
   - Store trusted internal IDs, not client input.

2. Make job creation idempotent.
   - Define the event that should create the job.
   - Prevent duplicate active jobs for the same work.
   - Do not depend on the frontend to prevent duplicates.

3. Insert the job.
   - Set status to `PENDING`.
   - Set `attemptCount` to zero.
   - Set a maximum attempt count.
   - Set `scheduledAt`.

4. Claim one eligible job atomically.
   - Select only `PENDING` jobs whose schedule has arrived.
   - Prevent two workers from processing the same job.
   - Change the status to `PROCESSING`.
   - Record the start time.

5. Validate the payload.
   - Confirm required records still exist.
   - Confirm the authenticated action that created the job remains valid where relevant.
   - Stop safely when the target was deleted.

6. Check whether work already completed.
   - Return success when the desired end state already exists.
   - Do not repeat provider calls or database writes unnecessarily.

7. Execute the job handler.
   - Keep the handler specific to one job type.
   - Use server-side services.
   - Keep long work outside request handlers.

8. Complete the job.
   - Set status to `COMPLETED`.
   - Set `completedAt`.
   - Store no sensitive output in the job payload.

9. Handle recoverable failure.
   - Increment the attempt count.
   - Record a safe error message.
   - Set a future `scheduledAt`.
   - Return the job to `PENDING`.

10. Handle permanent failure.
    - Set status to `FAILED`.
    - Stop retrying.
    - Update the target resource when the user must see a failed state.

11. Recover abandoned jobs.
    - Detect jobs left in `PROCESSING` beyond the allowed worker window.
    - Return them to a safe retry path.
    - Do not run two copies simultaneously.

## Code Skeleton

```ts
type JobHandler = (payload: unknown) => Promise<void>;

export async function runNextJob() {
  const job = await claimNextJobAtomically();

  if (!job) {
    return;
  }

  const handler = handlers[job.type] satisfies JobHandler | undefined;

  if (!handler) {
    await failJobPermanently(job.id, "UNKNOWN_JOB_TYPE");
    return;
  }

  try {
    await handler(job.payload);

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    if (isPermanentJobError(error)) {
      await failJobPermanently(job.id, safeErrorCode(error));
      return;
    }

    await retryJob(job, safeErrorCode(error));
  }
}
export async function createUniqueJob(input: {
  type: BackgroundJobType;
  deduplicationKey: string;
  payload: Prisma.InputJsonValue;
}) {
  return prisma.backgroundJob.upsert({
    where: {
      type_deduplicationKey: {
        type: input.type,
        deduplicationKey: input.deduplicationKey,
      },
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
    update: {},
  });
}
```

## Common Traps

- Claiming a job without an atomic lock.
- Creating duplicate jobs for the same File or generation.
- Treating every failure as retryable.
- Retrying permanently corrupted files.
- Storing document text or secrets in job payloads.
- Marking a job complete before its database writes finish.
- Performing the same provider call twice after a worker restart.
- Leaving jobs stuck in PROCESSING.
- Using Redis or another queue without approval.
- Hiding user-visible failure states.

## Verify Before Done

- [ ] Job types use constrained values.
- [ ] Payloads contain only trusted internal identifiers.
- [ ] Duplicate active work is prevented.
- [ ] Job claiming is atomic.
- [ ] Handlers are idempotent.
- [ ] Recoverable and permanent failures are separated.
- [ ] Retry count and scheduling are updated.
- [ ] Abandoned jobs can recover.
- [ ] Sensitive content is not stored in payloads or logs.
- [ ] Target records receive the correct success or failure state.

Write tests for:

- Single job claim.
- Two workers attempting the same job.
- Duplicate job creation.
- Successful completion.
- Recoverable failure and retry.
- Maximum attempts reached.
- Permanent failure.
- Deleted target record.
- Worker restart after partial completion.
- Abandoned PROCESSING job recovery.