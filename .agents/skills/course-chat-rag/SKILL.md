---
name: course-chat-rag
description: Use when implementing or changing Course Chat, lazy embeddings, semantic retrieval, ContentChunk search, context assembly, prompt injection protection, grounded answers, ChatSession, ChatMessage, ChatCitation, or source references. Trigger words include RAG, Course Chat, embeddings, semantic search, retrieval, citations, source chunks, grounded response, prompt injection, and answer from uploaded materials.
---

# Course Chat RAG

This skill teaches the complete Course-grounded chat workflow.

The governing laws are in:

- `.agents/rules/ai-pipeline.md`
- `.agents/rules/security.md`
- `.agents/rules/database-schema.md`
- `.agents/rules/money-and-billing.md`

## Procedure

1. Authenticate the student.
   - Resolve the session on the server.
   - Reject unauthenticated chat requests.

2. Verify Course ownership.
   - Query by Course ID and authenticated user ID.
   - Never retrieve chunks before ownership succeeds.

3. Validate the message.
   - Require non-empty user text.
   - Apply configured length limits.
   - Treat all user text as untrusted.

4. Check Chat allowance.
   - Load the active plan.
   - Check server-side Chat usage.
   - Reject before provider calls when the limit is reached.
   - Do not record usage yet.

5. Check Course readiness.
   - Require at least one `READY` File and ContentChunk.
   - Return a clear message when Course content is unavailable.

6. Generate embeddings lazily.
   - Check whether current chunks have embeddings for the configured model.
   - Create an embedding job only for missing or stale embeddings.
   - Do not generate embeddings automatically at upload time.
   - Reuse valid cached embeddings.

7. Embed the user question.
   - Call the provider from the backend.
   - Do not expose credentials.
   - Do not store unnecessary private data.

8. Retrieve Course-scoped chunks.
   - Search only embeddings connected to the current Course.
   - Select the smallest useful set of relevant chunks.
   - Preserve File and page references.
   - Never retrieve another user's content.

9. Decide whether evidence is sufficient.
   - If no relevant chunks exist, do not call the answer model as if evidence exists.
   - Return that the answer was not found in the uploaded materials.

10. Build protected context.
    - Include system instructions, retrieved chunks, and the user's question.
    - Mark uploaded text as data, never instructions.
    - Ignore prompt-injection text inside Course materials.

11. Generate the answer.
    - Require the model to answer only from supplied context.
    - Require uncertainty when the context is insufficient.
    - Do not use general model knowledge as a fallback.

12. Validate grounding.
    - Confirm that cited chunks were retrieved.
    - Reject fabricated or missing citation references.
    - Do not return a successful grounded answer without evidence.

13. Save the conversation.
    - Create or reuse the owned ChatSession.
    - Save the user message.
    - Save the assistant message.
    - Create structured ChatCitation records linked to ContentChunks.

14. Record usage.
    - Record one successful Chat usage event after persistence.
    - Do not count failed retrieval or failed model calls.

15. Return safe output.
    - Return the answer and user-facing source references.
    - Never return hidden prompts, embeddings, storage keys, or internal configuration.

## Code Skeleton

```ts
export async function answerCourseQuestion(input: {
  courseId: string;
  sessionId?: string;
  message: string;
}) {
  const session = await requireSession();
  const question = chatMessageSchema.parse(input.message);

  const course = await loadOwnedCourse(input.courseId, session.user.id);

  await assertChatAllowed(session.user.id);
  await assertCourseHasChunks(course.id);
  await ensureCourseEmbeddings(course.id);

  const questionVector = await embeddingProvider.embed(question);

  const chunks = await retrieveOwnedCourseChunks({
    courseId: course.id,
    vector: questionVector,
    limit: 6,
  });

  if (!hasSufficientEvidence(chunks)) {
    return saveUnsupportedAnswer({
      userId: session.user.id,
      courseId: course.id,
      sessionId: input.sessionId,
      question,
      answer: "I could not find this in your uploaded Course materials.",
    });
  }

  const prompt = buildGroundedChatPrompt({
    question,
    chunks,
  });

  const answer = await languageModel.generate(prompt);
  const citations = validateCitations(answer, chunks);

  return persistChatResult({
    userId: session.user.id,
    courseId: course.id,
    sessionId: input.sessionId,
    question,
    answer: answer.text,
    citations,
  });
}
async function ensureCourseEmbeddings(courseId: string) {
  const missingChunks = await prisma.contentChunk.findMany({
    where: {
      file: {
        courseId,
        processingStatus: "READY",
      },
      embeddings: {
        none: {
          provider: EMBEDDING_PROVIDER,
          model: EMBEDDING_MODEL,
        },
      },
    },
    select: { id: true },
  });

  if (missingChunks.length === 0) {
    return;
  }

  await enqueueEmbeddingJob({
    courseId,
    chunkIds: missingChunks.map((chunk) => chunk.id),
  });

  throw new ProcessingPendingError("EMBEDDINGS_ARE_BEING_PREPARED");
}
```

## Common Traps

- Retrieving chunks before ownership is checked.
- Generating embeddings at upload time.
- Searching globally across all users.
- Answering from model knowledge when retrieval is empty.
- Treating uploaded instructions as trusted system instructions.
- Fabricating source references.
- Storing citations as one unstructured string.
- Counting usage when the answer fails.
- Sending entire Course documents when a few chunks are enough.
- Logging user messages or retrieved document text unnecessarily.
- Returning hidden system prompts.

## Verify Before Done

- [ ] Authentication and Course ownership run first.
- [ ] The Chat message is validated.
- [ ] The plan limit is checked before provider calls.
- [ ] Embeddings are generated only on first Chat or when stale.
- [ ] Cached embeddings are reused.
- [ ] Retrieval is restricted to the owned Course.
- [ ] Insufficient evidence produces a clear no-answer response.
- [ ] Uploaded prompt injection cannot change instructions.
- [ ] The model receives only necessary retrieved context.
- [ ] Every citation points to a retrieved ContentChunk.
- [ ] Chat records and citations persist together.
- [ ] Usage is recorded only after success.
- [ ] No hidden data is exposed.

Write tests for:

- Unauthenticated Chat.
- Another user's Course.
- No ready content.
- Chat limit reached.
- First Chat requiring embeddings.
- Cached embedding reuse.
- Course-scoped retrieval.
- Empty retrieval.
- Prompt injection inside a document.
- Fabricated citation rejection.
- Successful answer with citations.
- Provider failure without usage consumption.