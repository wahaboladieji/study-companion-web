import "server-only";
import { prisma } from "@/lib/prisma";
import { objectStorage } from "@/lib/storage/object-storage";
import { ocrImageBytes } from "@/lib/ai/ocr";
import { cleanExtractedText } from "@/lib/ai/text-cleaner";
import { generateStudyNoteFromExtractedText } from "@/lib/ai/study-note-generator";
import { assertRateLimit, RATE_LIMITS } from "@/services/rate-limit";
import { invalidateCourseCache } from "@/services/course";

/**
 * Returns true if the file type is an image that requires OCR.
 */
function isImageType(fileType: string): boolean {
  return (
    fileType === "image/jpeg" ||
    fileType === "image/jpg" ||
    fileType === "image/png"
  );
}

/**
 * Splits text into overlapping chunks of ~CHUNK_SIZE characters,
 * preferring paragraph or sentence boundaries.
 */
function chunkText(
  text: string
): { text: string; chunkIndex: number; charStart: number; charEnd: number }[] {
  const CHUNK_SIZE = 500;
  const CHUNK_OVERLAP = 50;
  const chunks: {
    text: string;
    chunkIndex: number;
    charStart: number;
    charEnd: number;
  }[] = [];
  let position = 0;
  let chunkIndex = 0;

  while (position < text.length) {
    let end = Math.min(position + CHUNK_SIZE, text.length);

    if (end < text.length) {
      const slice = text.slice(position, end + 100);
      const paraBreak = slice.lastIndexOf("\n\n");
      const sentenceBreak = slice.search(/[.!?]\s/g);
      const wordBreak = slice.lastIndexOf(" ");

      if (paraBreak > CHUNK_SIZE / 2) {
        end = position + paraBreak + 2;
      } else if (sentenceBreak > CHUNK_SIZE / 2) {
        end = position + sentenceBreak + 2;
      } else if (wordBreak > CHUNK_SIZE / 3) {
        end = position + wordBreak + 1;
      }
    }

    const chunkText = text.slice(position, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        chunkIndex,
        charStart: position,
        charEnd: end,
      });
      chunkIndex++;
    }

    position = Math.max(end - CHUNK_OVERLAP, end);
    if (position >= text.length) break;
  }

  return chunks;
}

/**
 * Safely parses a PDF buffer using pdf-parse (supporting both v1 and v2 exports).
 */
async function parsePdfBuffer(fileBytes: Buffer): Promise<{ text: string; pageCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfModule = require("pdf-parse");
  if (typeof pdfModule === "function") {
    const parsed = await pdfModule(fileBytes);
    return { text: parsed.text ?? "", pageCount: parsed.numpages ?? 1 };
  } else if (pdfModule && typeof pdfModule.PDFParse === "function") {
    const parser = new pdfModule.PDFParse({ data: fileBytes });
    const result = await parser.getText();
    return { text: result.text ?? "", pageCount: result.total ?? result.pages?.length ?? 1 };
  }
  throw new Error("Unsupported pdf-parse module format");
}

/**
 * Extracts raw text from a PDF buffer.
 * Falls back to Gemini OCR if no text content is found (scanned PDF).
 */
async function extractPdfText(fileBytes: Buffer, courseId: string): Promise<string> {
  try {
    const parsed = await parsePdfBuffer(fileBytes);
    const pdfText = parsed.text?.trim() ?? "";

    // Heuristic: if the PDF has very little text, it is likely scanned — use OCR
    const MIN_CHARS_PER_PAGE = 50;
    const pageCount = Math.max(parsed.pageCount, 1);
    if (pdfText.length < MIN_CHARS_PER_PAGE * pageCount) {
      console.log("[DocumentProcessor] PDF appears scanned — using Gemini OCR");
      await assertRateLimit({
        ...RATE_LIMITS.OCR_REQUEST,
        key: `course:${courseId}`,
      });
      return await ocrImageBytes(fileBytes, "application/pdf");
    }

    return pdfText;
  } catch (err) {
    // Re-throw rate limit errors so the worker can retry later.
    if ((err as Error)?.name === "RateLimitError") throw err;

    console.warn(
      "[DocumentProcessor] pdf-parse failed, falling back to Gemini OCR:",
      err instanceof Error ? err.message : "unknown"
    );
    await assertRateLimit({
      ...RATE_LIMITS.OCR_REQUEST,
      key: `course:${courseId}`,
    });
    return await ocrImageBytes(fileBytes, "application/pdf");
  }
}

/**
 * Full processing pipeline for a single uploaded file:
 * 1. Fetch file bytes from storage
 * 2. Extract raw text (OCR for images, pdf-parse or OCR for PDFs, plain for docs)
 * 3. Clean text with DeepSeek
 * 4. Save ExtractedContent
 * 5. Split into chunks and save ContentChunks
 * 6. Mark file READY
 *
 * Throws on unrecoverable errors so the background worker can set status FAILED.
 */
export async function processFileContent(fileId: string): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      storageKey: true,
      fileType: true,
      processingStatus: true,
      courseId: true,
    },
  });

  if (!file) {
    // File was deleted — nothing to do
    return;
  }

  if (file.processingStatus === "READY") {
    return;
  }

  // Mark as PROCESSING
  await prisma.file.update({
    where: { id: file.id },
    data: { processingStatus: "PROCESSING", processingError: null },
  });

  // ── Step 1: Fetch raw bytes ──────────────────────────────────────────────
  let fileBytes: Buffer;
  try {
    fileBytes = await objectStorage.get(file.storageKey);
  } catch (err) {
    throw new Error(
      `Failed to fetch file from storage: ${err instanceof Error ? err.message : "unknown"}`
    );
  }

  // ── Step 2: Extract raw text ─────────────────────────────────────────────
  let rawText: string;
  try {
    if (isImageType(file.fileType)) {
      const mime = file.fileType as "image/jpeg" | "image/png" | "image/jpg";
      // Rate-limit OCR: 30 Gemini vision calls per course per hour.
      await assertRateLimit({
        ...RATE_LIMITS.OCR_REQUEST,
        key: `course:${file.courseId}`,
      });
      rawText = await ocrImageBytes(fileBytes, mime);
    } else if (file.fileType === "application/pdf") {
      rawText = await extractPdfText(fileBytes, file.courseId);
    } else {
      // DOCX / PPTX — attempt to extract text as UTF-8
      // These are ZIP-based XML formats; for now extract any readable text segments
      rawText = fileBytes.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim();
      if (rawText.length < 20) {
        // Very little readable text — use Gemini as a fallback vision extractor
        await assertRateLimit({
          ...RATE_LIMITS.OCR_REQUEST,
          key: `course:${file.courseId}`,
        });
        rawText = await ocrImageBytes(fileBytes, "application/pdf");
      }
    }
  } catch (err) {
    throw new Error(
      `Text extraction failed: ${err instanceof Error ? err.message : "unknown"}`
    );
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error(
      "No text could be extracted from this file. It may be empty or corrupted."
    );
  }

  // ── Step 3: Clean text with DeepSeek ────────────────────────────────────
  let cleanedText: string;
  try {
    cleanedText = await cleanExtractedText(rawText);
  } catch (err) {
    // Cleaning failure is non-fatal — use raw text
    console.warn(
      "[DocumentProcessor] Text cleaning failed, using raw text:",
      err instanceof Error ? err.message : "unknown"
    );
    cleanedText = rawText;
  }

  // ── Step 4 & 5: Persist extracted content and chunks ────────────────────
  const chunks = chunkText(cleanedText);

  await prisma.$transaction(async (tx) => {
    // Remove any stale extracted content (e.g., from a previous failed attempt)
    await tx.extractedContent.deleteMany({ where: { fileId: file.id } });
    await tx.contentChunk.deleteMany({ where: { fileId: file.id } });

    await tx.extractedContent.create({
      data: {
        fileId: file.id,
        rawText,
        cleanedText,
      },
    });

    if (chunks.length > 0) {
      await tx.contentChunk.createMany({
        data: chunks.map((chunk) => ({
          fileId: file.id,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
        })),
        skipDuplicates: true,
      });
    }

    // ── Step 6: Mark READY ───────────────────────────────────────────────
    await tx.file.update({
      where: { id: file.id },
      data: { processingStatus: "READY", processingError: null },
    });

    await tx.course.update({
      where: { id: file.courseId },
      data: { updatedAt: new Date() },
    });
  });

  // Invalidate course cache so polling and re-renders see READY status
  await invalidateCourseCache(file.courseId);

  // ── Step 7: Generate AI Study Note via DeepSeek ──────────────────────────
  try {
    const course = await prisma.course.findUnique({
      where: { id: file.courseId },
      select: { name: true },
    });

    // Gather all extracted text from ready files in this course
    const allExtracted = await prisma.extractedContent.findMany({
      where: { file: { courseId: file.courseId, processingStatus: "READY" } },
      select: { cleanedText: true, rawText: true },
    });

    const combinedText = allExtracted
      .map((e) => e.cleanedText || e.rawText)
      .filter(Boolean)
      .join("\n\n---\n\n");

    if (combinedText.trim().length > 0) {
      await generateStudyNoteFromExtractedText({
        courseId: file.courseId,
        transcribedText: combinedText,
        courseName: course?.name,
      });
    }

    // Invalidate again so the cached course detail includes the new study note
    await invalidateCourseCache(file.courseId);
  } catch (err) {
    console.warn(
      "[DocumentProcessor] Study Note generation warning:",
      err instanceof Error ? err.message : "unknown"
    );
    // Still invalidate cache so READY status is visible even if note generation failed
    await invalidateCourseCache(file.courseId);
  }
}
