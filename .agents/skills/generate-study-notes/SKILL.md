---
name: generate-study-notes
description: Use when implementing or changing Study Notes generation, note regeneration, Course note prompts, chunk summaries, merged notes, editable note persistence, generation status, or Study Notes usage accounting. Trigger words include Generate Study Notes, StudyNote, regenerate notes, Course notes, chunk summary, note prompt, AI notes, and STUDY_NOTES generation.
---

# Generate Study Notes

This skill teaches the complete on-demand Study Notes workflow.

The governing laws are in:

- `.agents/rules/ai-pipeline.md`
- `.agents/rules/money-and-billing.md`
- `.agents/rules/security.md`
- `.agents/rules/database-schema.md`

## Procedure

1. Authenticate and verify Course ownership.
   - Reject unauthenticated requests.
   - Query the Course by Course ID and authenticated user ID.

2. Confirm explicit user intent.
   - Start only after the student selects Generate Study Notes.
   - Never trigger generation automatically after upload.

3. Handle existing notes.
   - Detect an existing StudyNote.
   - Require explicit replacement confirmation before regeneration.
   - Do not silently overwrite edited notes.

4. Check Course readiness.
   - Load only Files with `READY` status.
   - Reject generation when no usable Course content exists.
   - Do not use failed or still-processing files.

5. Enforce usage limits.
   - Check the active plan on the server.
   - Reject the request before provider work if the limit is reached.
   - Do not record usage yet.

6. Create a Generation record and background job.
   - Set generation status to `PENDING`.
   - Use type `STUDY_NOTES`.
   - Deduplicate repeated requests for the same active generation.

7. Load Course content inside the worker.
   - Read cleaned text or ContentChunks.
   - Keep every input tied to its Course and source File.
   - Never include content from another Course.

8. Select the generation path.
   - Use direct generation when content fits the model context.
   - Use chunk-level intermediate summaries when content exceeds the context limit.
   - Merge intermediate results into one final note.

9. Construct a protected prompt.
   - Treat Course text as untrusted data.
   - Ask for organized notes, key concepts, definitions, important facts, and formulas where applicable.
   - Do not ask the model to add outside knowledge.

10. Validate the AI output.
    - Reject empty or malformed output.
    - Confirm the output is grounded in supplied Course content.
    - Do not save partial provider output as complete.

11. Save the note.
    - Create or replace the StudyNote only after successful generation.
    - Use the existing note replacement confirmation.
    - Keep the note editable.

12. Complete usage accounting.
    - Mark Generation `COMPLETED`.
    - Record successful usage.
    - Do not consume usage when generation fails.

13. Handle failure.
    - Mark Generation `FAILED`.
    - Store a safe error code.
    - Preserve the existing StudyNote.
    - Allow the student to retry.

## Code Skeleton

```ts
export async function requestStudyNotesGeneration(input: {
  courseId: string;
  replaceExisting: boolean;
}) {
  const session = await requireSession();

  const course = await loadOwnedCourse(input.courseId, session.user.id);
  const existingNote = await prisma.studyNote.findFirst({
    where: { courseId: course.id },
  });

  if (existingNote && !input.replaceExisting) {
    throw new ConflictError("REPLACEMENT_CONFIRMATION_REQUIRED");
  }

  await assertGenerationAllowed(session.user.id);

  const readyFileCount = await prisma.file.count({
    where: {
      courseId: course.id,
      processingStatus: "READY",
    },
  });

  if (readyFileCount === 0) {
    throw new ValidationError("NO_READY_COURSE_CONTENT");
  }

  return createGenerationJob({
    userId: session.user.id,
    courseId: course.id,
    type: "STUDY_NOTES",
    payload: {
      courseId: course.id,
      replaceExisting: input.replaceExisting,
    },
  });
}
export async function runStudyNotesGeneration(input: {
  generationId: string;
  courseId: string;
  userId: string;
  replaceExisting: boolean;
}) {
  const chunks = await loadReadyCourseChunks(input.courseId);

  const content = fitsModelContext(chunks)
    ? await generateNotesFromChunks(chunks)
    : await generateNotesFromIntermediateSummaries(chunks);

  validateStudyNotes(content);

  await prisma.$transaction(async (tx) => {
    if (input.replaceExisting) {
      await tx.studyNote.deleteMany({
        where: { courseId: input.courseId },
      });
    }

    await tx.studyNote.create({
      data: {
        courseId: input.courseId,
        title: "Study Notes",
        content,
      },
    });

    await tx.generation.update({
      where: { id: input.generationId },
      data: {
        status: "COMPLETED",
        outputContent: content,
      },
    });

    await tx.usageEvent.create({
      data: {
        userId: input.userId,
        courseId: input.courseId,
        eventType: "STUDY_NOTES_GENERATED",
        quantity: 1,
        billingPeriod: getCurrentBillingPeriod(),
      },
    });
  });
}
```

## Common Traps

- Generating notes immediately after upload.
- Including Files that are not READY.
- Sending an oversized Course in one model request.
- Overwriting edited notes without confirmation.
- Recording usage before successful persistence.
- Using model knowledge outside supplied Course content.
- Mixing chunks from different Courses.
- Saving empty or partial provider output.
- Deleting the existing note before the new note succeeds.
- Running generation in the API request.

## Verify Before Done

- [ ] Generation starts only after user action.
- [ ] Course ownership is verified.
- [ ] Existing note replacement requires confirmation.
- [ ] Only READY content is used.
- [ ] Plan limits are checked before generation.
- [ ] Work runs in a background job.
- [ ] Large Course content uses chunk summaries.
- [ ] Prompts forbid unsupported knowledge.
- [ ] Output is validated before saving.
- [ ] Existing notes survive failed regeneration.
- [ ] Usage is recorded only after success.
- [ ] Failed generations remain retryable.

Write tests for:

- Unauthenticated request.
- Another user's Course.
- No ready Course content.
- Usage limit reached.
- Existing note without replacement confirmation.
- Small Course generation.
- Large Course chunk-and-merge generation.
- Provider failure.
- Empty output.
- Successful replacement.
- Failed replacement preserving the old note.
- Usage recorded only after success.