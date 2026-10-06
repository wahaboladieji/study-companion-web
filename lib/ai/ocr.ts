import "server-only";
import { gemini } from "@/lib/ai/provider";
import { aiConfig } from "@/lib/ai/config";

/**
 * Uses Gemini's vision model to perform OCR on an image or scanned PDF page.
 * Returns the raw extracted text.
 */
export async function ocrImageBytes(
  imageBytes: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/jpg" | "application/pdf"
): Promise<string> {
  const model = aiConfig.gemini.visionModel;

  const response = await gemini.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBytes.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: [
        "You are an expert OCR engine.",
        "Transcribe ALL text visible in this image or document exactly as it appears.",
        "Preserve paragraph breaks and list structures.",
        "Do NOT add commentary, headings, or explanations — only return the transcribed text.",
        "If no text is present, respond with an empty string.",
      ].join(" "),
      temperature: aiConfig.tasks.ocr.temperature,
      maxOutputTokens: aiConfig.tasks.ocr.maxTokens,
    },
  });

  const text = response.text ?? "";
  return text.trim();
}
