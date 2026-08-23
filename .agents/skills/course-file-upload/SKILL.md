---
name: course-file-upload
description: Use when implementing or changing a file upload endpoint, upload form, signed upload flow, Course material intake, storage quota check, duplicate filename warning, or upload background-job creation. Trigger words include upload, PDF, DOCX, PPTX, JPG, JPEG, PNG, file picker, storage quota, duplicate filename, object storage, and Course material.
---

# Course File Upload

This skill teaches the safe upload sequence for Course materials.

The governing laws are in:

- `.agents/rules/uploads-and-storage.md`
- `.agents/rules/security.md`
- `.agents/rules/database-schema.md`
- `.agents/rules/money-and-billing.md`

## Procedure

1. Authenticate the student.
   - Resolve the server session.
   - Reject unauthenticated uploads.

2. Validate the Course.
   - Confirm the Course exists.
   - Confirm the authenticated student owns it.
   - Never accept a Course solely because the client sent its ID.

3. Validate upload metadata.
   - Allow only PDF, DOCX, PPTX, JPG, JPEG, and PNG.
   - Check the configured maximum size.
   - Reject empty files.
   - Do not trust the extension or browser MIME type alone.

4. Check storage allowance.
   - Load the active plan.
   - Calculate current server-side storage usage.
   - Reject the upload before storage if it would exceed the limit.
   - Do not create usage records yet.

5. Check duplicate filenames.
   - Search the Course for the same original filename.
   - Return a warning when a duplicate exists.
   - Allow the user to continue.
   - Never use the original filename as a unique key.

6. Create a unique storage key.
   - Use an internal unique identifier.
   - Keep the original filename as metadata only.
   - Never expose the internal key to the client.

7. Store the original file.
   - Upload to private object storage.
   - Do not perform OCR, extraction, or AI generation inside the upload request.
   - If storage fails, do not create database metadata or consume quota.

8. Create database metadata.
   - Create the File record with `UPLOADED` status.
   - Save original filename, size, type, and internal storage key.
   - Link the File to exactly one Course.

9. Update storage accounting.
   - Record successful storage usage on the server.
   - Do not count failed uploads.
   - Keep usage recording and File creation consistent.

10. Enqueue processing.
    - Create a PostgreSQL-backed processing job.
    - Include only trusted internal identifiers.
    - Make job creation idempotent.

11. Return the accepted upload.
    - Return safe File metadata.
    - Return status as `UPLOADED`.
    - Never return storage credentials or internal object paths.

12. Recover from partial failure.
    - If storage succeeds but metadata creation fails, schedule object cleanup.
    - If metadata succeeds but job creation fails, record the failure and allow retry.
    - Never leave silent orphaned objects.

## Code Skeleton

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma/client";
import { objectStorage } from "@/lib/storage/object-storage";
import { requireSession } from "@/features/auth/server/require-session";
import { assertUploadAllowed } from "@/features/billing/server/assert-upload-allowed";

type UploadInput = {
  courseId: string;
  fileName: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
};

export async function uploadCourseFile(input: UploadInput) {
  const session = await requireSession();

  const course = await prisma.course.findFirst({
    where: {
      id: input.courseId,
      userId: session.user.id,
    },
    select: { id: true },
  });

  if (!course) {
    throw new Error("COURSE_NOT_FOUND");
  }

  await assertUploadAllowed({
    userId: session.user.id,
    fileSize: input.size,
  });

  const storageKey = `courses/${course.id}/${randomUUID()}`;

  await objectStorage.put({
    key: storageKey,
    body: input.bytes,
    contentType: input.mimeType,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          courseId: course.id,
          fileName: input.fileName,
          fileType: input.mimeType,
          fileSize: input.size,
          storageKey,
          processingStatus: "UPLOADED",
          retryCount: 0,
        },
      });

      await tx.usageEvent.create({
        data: {
          userId: session.user.id,
          courseId: course.id,
          eventType: "STORAGE_USED",
          quantity: input.size,
          billingPeriod: getCurrentBillingPeriod(),
        },
      });

      await tx.backgroundJob.create({
        data: {
          type: "PROCESS_FILE",
          status: "PENDING",
          payload: { fileId: file.id },
          attemptCount: 0,
          maximumAttempts: 3,
          scheduledAt: new Date(),
        },
      });

      return file;
    });
  } catch (error) {
    await scheduleStorageCleanup(storageKey);
    throw error;
  }
}
```

## Common Traps

- Trusting the filename extension.
- Uploading directly into a public bucket.
- Running OCR inside the HTTP upload request.
- Creating the File record before object storage succeeds.
- Counting failed uploads against storage quota.
- Using the original filename as the object key.
- Returning the storage key to the browser.
- Accepting a Course that belongs to another user.
- Automatically generating notes or flashcards after upload.
- Ignoring partial failures between storage and PostgreSQL.

## Verify Before Done

- [ ] Only approved file types are accepted.
- [ ] File size is checked on the server.
- [ ] The Course owner is verified.
- [ ] Storage quota is checked before upload.
- [ ] Duplicate filenames produce a warning but remain allowed.
- [ ] A unique internal storage key is used.
- [ ] The bucket or object is private.
- [ ] Heavy processing is not performed in the request.
- [ ] Failed uploads do not consume quota.
- [ ] File metadata and processing job are created safely.
- [ ] Partial failure cleanup exists.
- [ ] No storage credentials or paths are returned.

Write tests for:

- Unsupported format.
- Empty file.
- Oversized file.
- Unauthenticated upload.
- Upload to another user's Course.
- Storage limit exceeded.
- Duplicate filename.
- Object storage failure.
- Database failure after storage success.
- Successful upload and job creation.