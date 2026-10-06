import "server-only";
import { prisma } from "@/lib/prisma";
import { deepseek } from "@/lib/ai/provider";
import { aiConfig } from "@/lib/ai/config";
import { generateText } from "ai";
import { assertRateLimit, RATE_LIMITS } from "@/services/rate-limit";

/**
 * Uses DeepSeek to generate a structured Study Note from transcribed course text,
 * and saves/upserts the generated note into the StudyNote database table for the course.
 */
export async function generateStudyNoteFromExtractedText(input: {
  courseId: string;
  transcribedText: string;
  courseName?: string;
}): Promise<{ id: string; title: string; content: string }> {
  if (!input.transcribedText || input.transcribedText.trim().length === 0) {
    throw new Error("Cannot generate Study Note: No transcribed text available.");
  }

  // Rate-limit: 5 study note generations per course per hour.
  // Keyed by courseId because this runs inside a background worker (no user session).
  // A RateLimitError here is retryable — the worker will reschedule after 5 minutes.
  await assertRateLimit({
    ...RATE_LIMITS.STUDY_NOTES_GENERATION,
    key: `course:${input.courseId}`,
  });

  const model = deepseek(aiConfig.deepseek.model);

  const { text: noteMarkdown } = await generateText({
    model,
    temperature: aiConfig.tasks.studyNotes.temperature,
    providerOptions: {
      deepseek: {
        thinking: { type: "disabled" },
      },
    },
    system: [
      "You are an elite academic study assistant.",
      "Your task is to transform transcribed lecture notes, handwritten study materials, and textbook documents into a clean, comprehensive, structured Study Guide.",
      "Do NOT use markdown syntax (do NOT use `#`, `##`, `**`, `*`, or markdown list dashes).",
      "Instead, write using normal English paragraphs and formal academic prose structured with HTML tags:",
      "1. Use <h1> for the main document title or executive summary header.",
      "2. Use <h2> for major section topics (Key Concepts, Core Content, Key Takeaways, Review Questions).",
      "3. Use <h3> for sub-topics and definitions.",
      "4. Use <p> for normal English paragraphs with complete, clear sentences.",
      "5. Use <ul> and <li> for bullet lists when listing key items or review questions.",
      "Rules:",
      "- Base your notes strictly on the provided transcribed text. Do not invent facts.",
      "- Write in clear, professional English paragraphs.",
      "- Do not output markdown code blocks or wrapper backticks (` ```html `). Return only clean HTML elements (<h1>, <h2>, <h3>, <p>, <ul>, <li>).",
    ].join("\n"),
    prompt: `Course Context: ${input.courseName ?? "Study Material"}\n\nTranscribed Material:\n${input.transcribedText}`,
  });

  const title = `${input.courseName ?? "Course"} — AI Study Notes`;
  const trimmedContent = noteMarkdown.trim();

  // Find existing note for this course to replace/upsert
  const existingNote = await prisma.studyNote.findFirst({
    where: { courseId: input.courseId },
    select: { id: true },
  });

  if (existingNote) {
    const updated = await prisma.studyNote.update({
      where: { id: existingNote.id },
      data: {
        title,
        content: trimmedContent,
      },
    });
    return {
      id: updated.id,
      title: updated.title,
      content: updated.content,
    };
  }

  const created = await prisma.studyNote.create({
    data: {
      courseId: input.courseId,
      title,
      content: trimmedContent,
    },
  });

  return {
    id: created.id,
    title: created.title,
    content: created.content,
  };
}
