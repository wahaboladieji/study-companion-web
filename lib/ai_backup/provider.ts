import { createDeepSeek } from "@ai-sdk/deepseek";
import { GoogleGenAI } from "@google/genai";
import { aiConfig } from "./config";

export const deepseek = createDeepSeek({
  apiKey: aiConfig.deepseek.apiKey,
  baseURL: aiConfig.deepseek.baseURL,
});

export const gemini = new GoogleGenAI({
  apiKey: aiConfig.gemini.apiKey,
});
