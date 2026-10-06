import "server-only";
import { deepseek } from "@/lib/ai/provider";
import { aiConfig } from "@/lib/ai/config";
import { generateText } from "ai";

/**
 * Uses DeepSeek to clean and structure raw extracted text from OCR or PDF parsing.
 * Removes OCR artifacts, normalises whitespace, and returns clean readable prose.
 */
export async function cleanExtractedText(rawText: string): Promise<string> {
  if (!rawText || rawText.trim().length === 0) {
    return "";
  }

  const model = deepseek(aiConfig.deepseek.model);

  const { text } = await generateText({
    model,
    temperature: 0.1,
    providerOptions: {
      deepseek: {
        thinking: { type: "disabled" },
      },
    },
    system: [
      "You are a text cleaning assistant.",
      "You receive raw text that may have been extracted from OCR, PDFs, or documents.",
      "Your job is to:",
      "1. Fix obvious OCR errors (e.g., 'rn' → 'm', 'I' confused with 'l', etc.)",
      "2. Remove headers, footers, page numbers, and repeated boilerplate.",
      "3. Normalise whitespace and paragraph breaks.",
      "4. Preserve all actual academic content exactly — do NOT summarise, paraphrase, or add anything.",
      "5. Return only the cleaned text with no commentary or markdown formatting.",
      "If the input is already clean, return it unchanged.",
    ].join("\n"),
    prompt: rawText,
  });

  return text.trim();
}
