export interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface GeminiConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  visionModel: string;
  embeddingModel: string;
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  topK: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface TaskDefaultsConfig {
  studyNotes: {
    provider: "deepseek" | "gemini";
    temperature: number;
    maxTokens: number;
  };
  flashcards: {
    provider: "deepseek" | "gemini";
    temperature: number;
    maxTokens: number;
  };
  chat: {
    provider: "deepseek" | "gemini";
    temperature: number;
    maxTokens: number;
  };
  ocr: {
    provider: "gemini";
    temperature: number;
    maxTokens: number;
  };
  embeddings: {
    provider: "gemini";
    model: string;
  };
}

export interface AiConfig {
  defaultProvider: "deepseek" | "gemini";
  deepseek: DeepSeekConfig;
  gemini: GeminiConfig;
  tasks: TaskDefaultsConfig;
}

function parseEnvInt(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseEnvFloat(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const parsed = parseFloat(val);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const aiConfig: AiConfig = {
  defaultProvider: (process.env.AI_DEFAULT_PROVIDER as "deepseek" | "gemini") ?? "deepseek",

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    temperature: parseEnvFloat(process.env.DEEPSEEK_TEMPERATURE, 0.7),
    maxTokens: parseEnvInt(process.env.DEEPSEEK_MAX_TOKENS, 4096),
    topP: parseEnvFloat(process.env.DEEPSEEK_TOP_P, 1.0),
    timeoutMs: parseEnvInt(process.env.DEEPSEEK_TIMEOUT_MS, 30000),
    maxRetries: parseEnvInt(process.env.DEEPSEEK_MAX_RETRIES, 3),
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    baseURL: process.env.GEMINI_BASE_URL || undefined,
    model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
    visionModel: process.env.GEMINI_VISION_MODEL ?? "gemini-3.6-flash",
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
    temperature: parseEnvFloat(process.env.GEMINI_TEMPERATURE, 0.7),
    maxOutputTokens: parseEnvInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 4096),
    topP: parseEnvFloat(process.env.GEMINI_TOP_P, 0.95),
    topK: parseEnvInt(process.env.GEMINI_TOP_K, 40),
    timeoutMs: parseEnvInt(process.env.GEMINI_TIMEOUT_MS, 30000),
    maxRetries: parseEnvInt(process.env.GEMINI_MAX_RETRIES, 3),
  },

  tasks: {
    studyNotes: {
      provider: (process.env.STUDY_NOTES_PROVIDER as "deepseek" | "gemini") ?? "deepseek",
      temperature: parseEnvFloat(process.env.STUDY_NOTES_TEMPERATURE, 0.5),
      maxTokens: parseEnvInt(process.env.STUDY_NOTES_MAX_TOKENS, 4096),
    },
    flashcards: {
      provider: (process.env.FLASHCARDS_PROVIDER as "deepseek" | "gemini") ?? "deepseek",
      temperature: parseEnvFloat(process.env.FLASHCARDS_TEMPERATURE, 0.7),
      maxTokens: parseEnvInt(process.env.FLASHCARDS_MAX_TOKENS, 2048),
    },
    chat: {
      provider: (process.env.CHAT_PROVIDER as "deepseek" | "gemini") ?? "deepseek",
      temperature: parseEnvFloat(process.env.CHAT_TEMPERATURE, 0.3),
      maxTokens: parseEnvInt(process.env.CHAT_MAX_TOKENS, 2048),
    },
    ocr: {
      provider: "gemini",
      temperature: parseEnvFloat(process.env.OCR_TEMPERATURE, 0.0),
      maxTokens: parseEnvInt(process.env.OCR_MAX_TOKENS, 4096),
    },
    embeddings: {
      provider: "gemini",
      model: process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
    },
  },
};

