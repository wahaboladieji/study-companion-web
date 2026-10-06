import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cacheService } from "@/lib/cache/cache-service";

export const RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";

export class RateLimitError extends Error {
  readonly bucket: string;
  readonly retryAfterSeconds: number;

  constructor(bucket: string, retryAfterSeconds: number) {
    super(RATE_LIMIT_MESSAGE);
    this.name = "RateLimitError";
    this.bucket = bucket;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const RATE_LIMITS = {
  SIGNUP: { bucket: "signup", limit: 5, windowSeconds: 60 * 60 },
  SIGNIN: { bucket: "signin", limit: 10, windowSeconds: 15 * 60 },
  PASSWORD_RESET_REQUEST: {
    bucket: "password-reset-request",
    limit: 5,
    windowSeconds: 60 * 60,
  },
  PASSWORD_RESET_SUBMIT: {
    bucket: "password-reset-submit",
    limit: 10,
    windowSeconds: 15 * 60,
  },
  UPLOAD: { bucket: "upload", limit: 30, windowSeconds: 15 * 60 },
  CHECKOUT: { bucket: "checkout", limit: 10, windowSeconds: 15 * 60 },
  PAYMENT_VERIFY: { bucket: "payment-verify", limit: 20, windowSeconds: 15 * 60 },
  FLUTTERWAVE_WEBHOOK: {
    bucket: "flutterwave-webhook",
    limit: 120,
    windowSeconds: 60,
  },

  // ── AI endpoint limits ────────────────────────────────────────────────────
  // Keyed by user ID at the action layer.
  COURSE_CHAT: {
    bucket: "course-chat",
    limit: 20,
    windowSeconds: 5 * 60, // 20 messages per user per 5 minutes
  },
  START_PROCESSING: {
    bucket: "start-processing",
    limit: 10,
    windowSeconds: 15 * 60, // 10 trigger attempts per user per 15 minutes
  },
  // Keyed by course ID inside background jobs (no user session available).
  STUDY_NOTES_GENERATION: {
    bucket: "study-notes-generation",
    limit: 5,
    windowSeconds: 60 * 60, // 5 generations per course per hour
  },
  OCR_REQUEST: {
    bucket: "ocr-request",
    limit: 30,
    windowSeconds: 60 * 60, // 30 OCR calls per course per hour
  },
} as const;

export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = requestHeaders.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

async function recordHit(options: {
  bucket: string;
  key: string;
  windowStart: Date;
}): Promise<number> {
  const { bucket, key, windowStart } = options;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const entry = await prisma.rateLimitEntry.upsert({
        where: { bucket_key_windowStart: { bucket, key, windowStart } },
        create: { bucket, key, windowStart, count: 1 },
        update: { count: { increment: 1 } },
      });
      return entry.count;
    } catch (error) {
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!isUniqueViolation) {
        throw error;
      }
      // A concurrent request created this window first; retry to increment it.
    }
  }

  const entry = await prisma.rateLimitEntry.update({
    where: { bucket_key_windowStart: { bucket, key, windowStart } },
    data: { count: { increment: 1 } },
  });
  return entry.count;
}

export async function assertRateLimit(options: {
  bucket: string;
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const { bucket, key, limit, windowSeconds } = options;

  let count: number;
  try {
    const cacheKey = `${bucket}:${key}`;
    count = await cacheService.increment(cacheKey, windowSeconds);
  } catch (err) {
    console.warn("[RateLimit] Cache increment error, falling back to database:", err);
    const windowMs = windowSeconds * 1000;
    const windowStart = new Date(
      Math.floor(Date.now() / windowMs) * windowMs
    );
    count = await recordHit({ bucket, key, windowStart });

    if (count === 1) {
      const retentionStart = new Date(windowStart.getTime() - windowMs);
      await prisma.rateLimitEntry.deleteMany({
        where: { bucket, key, windowStart: { lt: retentionStart } },
      });
    }
  }

  if (count > limit) {
    throw new RateLimitError(bucket, windowSeconds);
  }
}

