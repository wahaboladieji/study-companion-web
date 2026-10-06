import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const CSRF_COOKIE = "csrf-token";
const CSRF_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

function signCsrfToken(raw: string): string {
  return createHmac("sha256", CSRF_SECRET).update(raw).digest("hex");
}

function createCsrfValue(): { raw: string; value: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, value: `${raw}|${signCsrfToken(raw)}` };
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function ensureCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE)?.value;

  if (existing) {
    const [raw, hash] = existing.split("|");
    if (raw && hash) {
      const expectedHash = signCsrfToken(raw);
      const expectedBuf = Buffer.from(expectedHash);
      const hashBuf = Buffer.from(hash);
      if (
        expectedBuf.length === hashBuf.length &&
        timingSafeEqual(expectedBuf, hashBuf)
      ) {
        return raw;
      }
    }
  }

  const { raw, value } = createCsrfValue();
  cookieStore.set(CSRF_COOKIE, value, getCsrfCookieOptions());
  return raw;
}

export async function validateCsrfToken(submitted: string | null): Promise<boolean> {
  if (!submitted) return false;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(CSRF_COOKIE)?.value;
  if (!cookieValue) return false;

  const [raw, hash] = cookieValue.split("|");
  if (!raw || !hash) return false;

  const submittedBuf = Buffer.from(submitted);
  const rawBuf = Buffer.from(raw);
  if (submittedBuf.length !== rawBuf.length) return false;
  if (!timingSafeEqual(submittedBuf, rawBuf)) return false;

  const expectedHash = signCsrfToken(raw);
  const expectedBuf = Buffer.from(expectedHash);
  const hashBuf = Buffer.from(hash);
  if (expectedBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(expectedBuf, hashBuf);
}
