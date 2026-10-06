"use server";

import { getCurrentUser } from "@/services/auth";
import { validateCsrfToken } from "@/services/csrf";
import { prisma } from "@/lib/prisma";
import { deepseek } from "@/lib/ai/provider";
import { aiConfig } from "@/lib/ai/config";
import { generateText } from "ai";
import {
  assertRateLimit,
  RateLimitError,
  RATE_LIMIT_MESSAGE,
  RATE_LIMITS,
} from "@/services/rate-limit";

export type ChatMessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type SendChatMessageState = {
  messages?: ChatMessageItem[];
  error?: string;
} | null;

/**
 * Server action to handle student AI Chat messages grounded strictly in Course materials.
 */
export async function sendCourseChatMessageAction(
  prevState: SendChatMessageState,
  formData: FormData
): Promise<SendChatMessageState> {
  const csrfToken = formData.get("csrfToken") as string | null;
  if (!(await validateCsrfToken(csrfToken))) {
    return { error: "Security check failed. Please refresh and try again." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in to use Course Chat." };
  }

  const courseId = formData.get("courseId") as string | null;
  const question = (formData.get("message") as string | null)?.trim();

  if (!courseId || !question) {
    return { error: "Please enter a valid question." };
  }

  // 1. Verify Course ownership
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: user.id },
    select: { id: true, name: true },
  });

  if (!course) {
    return { error: "Course not found." };
  }

  // 2. Rate-limit AI calls: 20 messages per user per 5 minutes
  try {
    await assertRateLimit({
      ...RATE_LIMITS.COURSE_CHAT,
      key: `user:${user.id}`,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: RATE_LIMIT_MESSAGE };
    }
    throw error;
  }

  // 3. Fetch all extracted content & study notes for this course
  const [extractedContents, studyNotes] = await Promise.all([
    prisma.extractedContent.findMany({
      where: { file: { courseId: course.id, processingStatus: "READY" } },
      select: { cleanedText: true, rawText: true, file: { select: { fileName: true } } },
    }),
    prisma.studyNote.findMany({
      where: { courseId: course.id },
      select: { title: true, content: true },
    }),
  ]);

  const courseContent = [
    ...studyNotes.map((n) => `[Study Guide: ${n.title}]\n${n.content}`),
    ...extractedContents.map(
      (e) => `[Source File: ${e.file.fileName}]\n${e.cleanedText || e.rawText}`
    ),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (!courseContent || courseContent.trim().length === 0) {
    return {
      error: "No processed materials found for this course. Please upload notes and click 'Start processing' first.",
    };
  }

  // 3. Generate grounded response via DeepSeek
  try {
    const model = deepseek(aiConfig.deepseek.model);

    const prevMessages = prevState?.messages ?? [];
    const recentHistory = prevMessages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Student" : "AI Tutor"}: ${m.content}`)
      .join("\n");

    const promptParts = [
      `Course Materials Context:\n${courseContent}`,
    ];

    if (recentHistory) {
      promptParts.push(`Recent Chat History:\n${recentHistory}`);
    }

    promptParts.push(`Student Question:\n${question}`);

    const { text: responseText } = await generateText({
      model,
      temperature: 0.1,
      providerOptions: {
        deepseek: {
          thinking: { type: "disabled" },
        },
      },
      system: [
        "You are an intelligent, helpful academic AI tutor.",
        "Your duty is to answer the student's question based strictly on the provided course materials and notes.",
        "STRICT GROUNDING RULES:",
        "1. Answer ONLY using information explicitly stated or directly inferable from the provided course materials.",
        "2. Do NOT use outside general knowledge or invent answers. Your knowledge for this session is strictly limited to the provided course materials.",
        "3. If the answer to the student's question cannot be found in the provided course materials, you MUST reply: 'The information you are looking for does not exist in the selected course/book.'",
        "4. Provide clear, structured, engaging answers in readable English.",
      ].join("\n"),
      prompt: promptParts.join("\n\n---\n\n"),
    });

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    const assistantMsg: ChatMessageItem = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: responseText.trim(),
      timestamp: new Date().toISOString(),
    };

    return {
      messages: [...prevMessages, userMsg, assistantMsg],
    };
  } catch (err) {
    console.error("[CourseChatAction] AI Error:", err);
    return {
      error: "Failed to generate answer. Please try again in a moment.",
    };
  }
}
