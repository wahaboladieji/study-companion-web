---
name: document-processing-pipeline
description: Use when implementing or changing OCR, text extraction, cleaning, source chunking, File processing states, processing retries, scanned PDF handling, image text recognition, or ContentChunk creation. Trigger words include OCR, extract text, clean text, chunk document, scanned PDF, processing status, File READY, File FAILED, retry processing, and ContentChunk.
---

# Document Processing Pipeline

This skill teaches the format-aware path from a stored file to source-linked text chunks.

The governing laws are in:

- `.agents/rules/ai-pipeline.md`
- `.agents/rules/uploads-and-storage.md`
- `.agents/rules/database-schema.md`
- `.agents/rules/security.md`

## Procedure

1. Claim the processing job.
   - Load the File by trusted job payload.
   - Stop if another worker already completed it.
   - Do not process a deleted or missing File.

2. Move the File to `PROCESSING`.
   - Record the start.
   - Clear only recoverable previous processing errors.
   - Do not create duplicate extraction records.

3. Fetch the original object.
   - Use the internal storage key.
   - Never use a client-provided URL.
   - Verify the object still exists.

4. Select the extraction path.
   - Use direct text extraction for DOCX, PPTX, and digital PDFs.
   - Use OCR for JPG, JPEG, PNG, and scanned PDFs.
   - Do not run OCR when reliable embedded text is available.

5. Extract text.
   - Preserve page or slide position where available.
   - Stop downstream processing if extraction fails.
   - Do not fabricate missing text.

6. Validate the extracted result.
   - Reject empty or unusable extraction.
   - Record a clear processing error.
   - Preserve the original file for retry.

7. Clean the text.
   - Normalize whitespace and line endings.
   - Remove extraction artifacts.
   - Preserve headings, paragraphs, lists, and academic meaning.
   - Do not rewrite or summarize during cleaning.

8. Split text into source-linked chunks.
   - Use headings, sections, paragraphs, and topic boundaries.
   - Store page number where available.
   - Store a stable chunk index.
   - Keep every chunk linked to its source File.

9. Save extraction and chunks.
   - Replace incomplete data from a previous failed attempt safely.
   - Use a transaction for database writes.
   - Do not create duplicate chunk indexes for the same File.

10. Mark the File `READY`.
    - Update the Course timestamp.
    - Record successful job completion.
    - Do not generate embeddings, notes, or flashcards.

11. Handle failure.
    - Mark the File `FAILED`.
    - Record a safe error message and retry count.
    - Retry only recoverable provider or storage failures.
    - Stop after the configured maximum attempts.

## Code Skeleton

```ts
export async function processStoredFile(fileId: string) {
  const file = await loadProcessableFile(fileId);

  if (file.processingStatus === "READY") {
    return { status: "ALREADY_COMPLETE" as const };
  }

  await markFileProcessing(file.id);

  try {
    const object = await objectStorage.get(file.storageKey);

    const extracted = await extractByFileType({
      fileType: file.fileType,
      bytes: object.bytes,
    });

    if (!extracted.text.trim()) {
      throw new PermanentProcessingError("NO_EXTRACTABLE_TEXT");
    }

    const cleanedText = cleanExtractedText(extracted.text);

    const chunks = createSemanticChunks({
      text: cleanedText,
      pageMap: extracted.pageMap,
    });

    await prisma.$transaction(async (tx) => {
      await tx.extractedContent.upsert({
        where: { fileId: file.id },
        create: {
          fileId: file.id,
          rawText: extracted.text,
          cleanedText,
        },
        update: {
          rawText: extracted.text,
          cleanedText,
        },
      });

      await tx.contentChunk.deleteMany({
        where: { fileId: file.id },
      });

      await tx.contentChunk.createMany({
        data: chunks.map((chunk, index) => ({
          fileId: file.id,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          chunkIndex: index,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
        })),
      });

      await tx.file.update({
        where: { id: file.id },
        data: {
          processingStatus: "READY",
          processingError: null,
        },
      });
    });

    return { status: "READY" as const };
  } catch (error) {
    await recordProcessingFailure(file.id, error);
    throw error;
  }
}
```

## Common Traps

- Running OCR on every PDF.
- Continuing after empty extraction.
- Summarizing during the cleaning stage.
- Creating chunks with no File reference.
- Generating embeddings immediately after upload.
- Marking the File READY before chunks are saved.
- Leaving duplicate chunks after retry.
- Replacing the original uploaded file.
- Retrying corrupted or unsupported files forever.
- Logging extracted student content.

## Verify Before Done

- [ ] Processing is idempotent.
- [ ] The correct extractor is selected by file type and content.
- [ ] OCR runs only when required.
- [ ] Empty extraction becomes a clear failure.
- [ ] Cleaning preserves meaning.
- [ ] Chunks preserve source and page references.
- [ ] Duplicate chunks are prevented.
- [ ] The File becomes READY only after successful persistence.
- [ ] Failures set FAILED and record retry information.
- [ ] No AI generation or embedding occurs during processing.
- [ ] Private document contents are not logged.

Write tests for:

- Digital PDF extraction.
- Scanned PDF OCR path.
- Image OCR path.
- DOCX extraction.
- PPTX extraction.
- Empty extraction.
- Corrupted object.
- Retry after temporary failure.
- Idempotent repeat processing.
- Chunk source linkage.