"use server";

import { getCurrentUser } from "@/services/auth";
import { verifyEmail, generateVerificationCode, enqueueVerificationEmail } from "@/services/verification";
import { redirect } from "next/navigation";

export async function verifyCodeAction(prevState: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?mode=signin");
  }

  const code = formData.get("code") as string;
  if (!code || code.trim().length === 0) {
    return { error: "Please enter a verification code." };
  }

  const result = await verifyEmail(user.id, code.trim());
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}

export async function sendVerificationCodeAction() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?mode=signin");
  }

  if (user.emailVerified) {
    return { error: "Email is already verified." };
  }

  await generateVerificationCode(user.id);
  await enqueueVerificationEmail(user.id);

  return { success: true, sentAt: Date.now() };
}
