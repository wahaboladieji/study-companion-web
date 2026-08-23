---
name: generate-course-flashcards
description: Use when implementing or changing AI Flashcard generation, flashcard regeneration, structured flashcard output, Flashcard validation, New Reviewing Mastered status, Course-grounded cards, or flashcard usage accounting. Trigger words include Generate Flashcards, Flashcard, regenerate cards, question and answer cards, structured AI output, NEW status, REVIEWING, MASTERED, and FLASHCARDS generation.
---

# Generate Course Flashcards

This skill teaches the on-demand Course-grounded Flashcard workflow.

The governing laws are in:

- `.agents/rules/ai-pipeline.md`
- `.agents/rules/database-schema.md`
- `.agents/rules/money-and-billing.md`
- `.agents/rules/security.md`

## Procedure

1. Authenticate and verify Course ownership.
   - Reject unauthenticated requests.
   - Load the Course using the authenticated user ID.

2. Confirm explicit user action.
   - Generate cards only after the student requests them.
   - Never generate cards automatically after upload.

3. Decide how existing cards are handled.
   - Do not silently delete edited cards.
   - Require explicit confirmation before destructive regeneration.
   - Keep existing cards until the replacement generation succeeds.

4. Check Course readiness.
   - Use only Files with `READY` status.
   - Reject generation when no usable content exists.

5. Enforce the plan limit.
   - Check generation allowance on the server.
   - Stop before provider work when the limit is reached.
   - Do not record usage yet.

6. Create a Generation record and job.
   - Use type `FLASHCARDS`.
   - Set status to `PENDING`.
   - Prevent duplicate active generation jobs.

7. Load Course chunks.
   - Retrieve only chunks from the owned Course.
   - Keep source context available during generation.
   - Do not mix Courses or users.

8. Select the generation path.
   - Generate directly when content fits.
   - Use chunk batches when content exceeds the model context.
   - Combine and deduplicate cards from each batch.

9. Request structured output.
   - Require a question and answer for every card.
   - Require output that can be parsed safely.
   - Forbid unsupported outside knowledge.

10. Validate and normalize cards.
    - Reject empty questions or answers.
    - Remove exact duplicates.
    - Do not save malformed output.
    - Set every new card status to `NEW`.

11. Persist atomically.
    - Replace old cards only after new cards pass validation.
    - Create the new cards in a transaction.
    - Complete the Generation record.

12. Record usage.
    - Create one successful generation usage event.
    - Do not count failed generations.

13. Handle failure.
    - Mark the Generation `FAILED`.
    - Keep existing flashcards unchanged.
    - Allow retry.

## Code Skeleton

```ts
const flashcardOutputSchema = z.object({
  flashcards: z.array(
    z.object({
      question: z.string().trim().min(1),
      answer: z.string().trim().min(1),
    }),
  ).min(1),
});

export async function requestFlashcardGeneration(input: {
  courseId: string;
  replaceExisting: boolean;
}) {
  const session = await requireSession();
  const course = await loadOwnedCourse(input.courseId, session.user.id);

  const existingCount = await prisma.flashcard.count({
    where: { courseId: course.id },
  });

  if (existingCount > 0 && !input.replaceExisting) {
    throw new ConflictError("REPLACEMENT_CONFIRMATION_REQUIRED");
  }

  await assertGenerationAllowed(session.user.id);
  await assertCourseHasReadyContent(course.id);

  return createGenerationJob({
    userId: session.user.id,
    courseId: course.id,
    type: "FLASHCARDS",
    payload: {
      courseId: course.id,
      replaceExisting: input.replaceExisting,
    },
  });
}
export async function saveGeneratedFlashcards(input: {
  generationId: string;
  userId: string;
  courseId: string;
  replaceExisting: boolean;
  rawOutput: unknown;
}) {
  const parsed = flashcardOutputSchema.parse(input.rawOutput);
  const flashcards = removeDuplicateCards(parsed.flashcards);

  await prisma.$transaction(async (tx) => {
    if (input.replaceExisting) {
      await tx.flashcard.deleteMany({
        where: { courseId: input.courseId },
      });
    }

    await tx.flashcard.createMany({
      data: flashcards.map((card) => ({
        courseId: input.courseId,
        question: card.question,
        answer: card.answer,
        status: "NEW",
      })),
    });

    await tx.generation.update({
      where: { id: input.generationId },
      data: {
        status: "COMPLETED",
      },
    });

    await tx.usageEvent.create({
      data: {
        userId: input.userId,
        courseId: input.courseId,
        eventType: "FLASHCARDS_GENERATED",
        quantity: 1,
        billingPeriod: getCurrentBillingPeriod(),
      },
    });
  });
}
```

## Common Traps

- Generating cards automatically.
- Using non-ready Files.
- Saving malformed model output.
- Creating cards with missing answers.
- Setting an initial status other than NEW.
- Deleting old cards before new cards succeed.
- Counting each card as a separate generation unless the plan explicitly requires it.
- Recording usage for failed output.
- Generating cards from general model knowledge.
- Duplicating cards across chunk batches.

## Verify Before Done

- [ ] Course ownership is checked.
- [ ] Generation is explicitly requested.
- [ ] Existing cards require replacement confirmation.
- [ ] Only READY Course content is used.
- [ ] Usage limits are checked first.
- [ ] Work runs in a background job.
- [ ] Output uses a validated structured shape.
- [ ] Empty and duplicate cards are rejected.
- [ ] Every new card starts as NEW.
- [ ] Existing cards survive failed regeneration.
- [ ] Usage is recorded only after success.
- [ ] Cards remain editable.

Write tests for:

- No Course access.
- No ready content.
- Usage limit reached.
- Existing cards without confirmation.
- Valid structured output.
- Malformed output.
- Empty cards.
- Duplicate removal.
- Initial NEW status.
- Failed regeneration preserving old cards.
- Successful replacement.
- Usage accounting after success only.