import { NextResponse } from "next/server";
import { ensureCsrfToken } from "@/services/csrf";

export async function GET() {
  const csrfToken = await ensureCsrfToken();
  return NextResponse.json({ csrfToken });
}
