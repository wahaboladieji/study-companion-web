---
name: course-data-deletion
description: Use when implementing or changing deletion of a Course, File, uploaded object, extracted content, chunks, embeddings, notes, flashcards, Chat data, citations, cleanup job, storage quota correction, or partial deletion recovery. Trigger words include delete Course, delete File, remove upload, cascade delete, cleanup storage, orphaned object, destructive action, data removal, and deletion retry.
---

# Course Data Deletion

This skill teaches safe deletion across PostgreSQL and object storage.

The governing laws are in:

- `.agents/rules/database-schema.md`
- `.agents/rules/uploads-and-storage.md`
- `.agents/rules/security.md`
- `.agents/rules/money-and-billing.md`

## Procedure

1. Identify the deletion scope.
   - Determine whether the request deletes one File or an entire Course.
   - List every dependent database record and storage object.
   - Do not expand deletion beyond the confirmed target.

2. Authenticate and verify ownership.
   - Resolve the server session.
   - Query the File or Course using the authenticated user ID.
   - Never delete by ID alone.

3. Require explicit confirmation.
   - Use the confirmed destructive action from the UI.
   - Do not infer confirmation from page navigation.
   - Return the affected scope before execution where the UI requires it.

4. Capture cleanup information.
   - Read internal storage keys and file sizes before database deletion.
   - Keep this information server-side.
   - Never expose storage keys to the client.

5. Block conflicting work.
   - Prevent new generation, upload processing, or Chat embedding work for the target.
   - Make active jobs stop safely when they see the target is deleted or unavailable.

6. Delete database dependents.
   - Follow explicit Prisma relation behavior.
   - Remove chunks, embeddings, extracted content, citations, messages, sessions, notes, flashcards, generations, and Files as required.
   - Keep billing and immutable usage history unless the rules explicitly require otherwise.

7. Delete storage objects.
   - Remove every original object tied to the deleted File or Course.
   - Use idempotent deletion.
   - Treat an already-missing object as safely deleted.

8. Correct storage accounting.
   - Decrease storage usage only for objects that were previously counted.
   - Calculate on the server.
   - Never create a negative usage balance.

9. Recover from partial failure.
   - If database deletion succeeds but object deletion fails, enqueue cleanup.
   - If object deletion succeeds but database deletion fails, retry database cleanup without restoring the object.
   - Record safe failure details.

10. Return a stable result.
    - Return only the deleted public identifier and status.
    - Do not return internal paths or removed private content.

11. Verify no orphan remains.
    - Check dependent database rows.
    - Check object cleanup status.
    - Check storage accounting.

## Code Skeleton

```ts
export async function deleteOwnedFile(input: {
  fileId: string;
  confirmed: boolean;
}) {
  if (!input.confirmed) {
    throw new ValidationError("DELETION_CONFIRMATION_REQUIRED");
  }

  const session = await requireSession();

  const file = await prisma.file.findFirst({
    where: {
      id: input.fileId,
      course: {
        userId: session.user.id,
      },
    },
    select: {
      id: true,
      courseId: true,
      storageKey: true,
      fileSize: true,
    },
  });

  if (!file) {
    throw new NotFoundError("FILE_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.backgroundJob.updateMany({
      where: {
        status: { in: ["PENDING", "PROCESSING"] },
        payload: {
          path: ["fileId"],
          equals: file.id,
        },
      },
      data: {
        status: "FAILED",
        errorMessage: "TARGET_DELETED",
      },
    });

    await tx.file.delete({
      where: { id: file.id },
    });

    await tx.usageEvent.create({
      data: {
        userId: session.user.id,
        courseId: file.courseId,
        eventType: "STORAGE_USED",
        quantity: -file.fileSize,
        billingPeriod: getCurrentBillingPeriod(),
      },
    });
  });

  try {
    await objectStorage.delete(file.storageKey);
  } catch {
    await enqueueStorageCleanup({
      storageKey: file.storageKey,
    });
  }

  return {
    ok: true as const,
    deletedId: file.id,
  };
}
```

## Common Traps

- Deleting by ID without ownership.
- Deleting without explicit confirmation.
- Removing immutable billing or usage history.
- Deleting PostgreSQL rows but leaving storage objects.
- Deleting storage first with no recovery path.
- Allowing active jobs to recreate deleted data.
- Reducing storage quota before confirming the File was counted.
- Producing a negative storage balance.
- Logging filenames, document text, or storage keys.
- Treating an already-missing object as a fatal failure.

## Verify Before Done

- [ ] The deletion target and dependents are known.
- [ ] Authentication and ownership are verified.
- [ ] Explicit confirmation is required.
- [ ] Internal cleanup data stays server-side.
- [ ] Conflicting background jobs stop safely.
- [ ] Dependent records follow explicit relation behavior.
- [ ] Immutable billing history is preserved.
- [ ] Object storage is cleaned.
- [ ] Partial failure creates a retry path.
- [ ] Storage usage is corrected safely.
- [ ] No orphaned data remains.
- [ ] The response exposes no private storage information.

Write tests for:

- Unauthenticated deletion.
- Another user's File or Course.
- Missing confirmation.
- File deletion with all dependents.
- Course deletion with all dependents.
- Object already missing.
- Object deletion failure and cleanup job.
- Active background job during deletion.
- Storage accounting correction.
- Repeated idempotent cleanup.