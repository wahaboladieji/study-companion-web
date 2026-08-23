"use server";

import { signUp, signIn, signOut } from "@/services/auth";
import { requestPasswordReset, resetPassword } from "@/services/password-reset";
import { validateCsrfToken } from "@/services/csrf";
import { redirect } from "next/navigation";

type AuthFormState = {
  error?: string;
  success?: boolean;
  email?: string;
} | null;

const CSRF_FAILURE = "Security check failed. Please refresh the page and try again.";

export async function signUpAction(prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!(await validateCsrfToken(formData.get("csrfToken") as string | null))) {
    return { error: CSRF_FAILURE };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const result = await signUp({ name, email, password });
  
  if (!result.success) {
    return { error: result.error };
  }

  redirect("/onboarding");
}

export async function signInAction(prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!(await validateCsrfToken(formData.get("csrfToken") as string | null))) {
    return { error: CSRF_FAILURE };
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const result = await signIn({ email, password });
  
  if (!result.success) {
    return { error: result.error };
  }

  if (result.user?.onboarded) {
    redirect("/dashboard");
  } else {
    redirect("/onboarding");
  }
}

export async function signOutAction() {
  await signOut();
  redirect("/auth?mode=signin");
}

export async function requestPasswordResetAction(prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = formData.get("email") as string;

  const result = await requestPasswordReset({ email });

  if (!result.success) {
    return { error: result.error };
  }

  return { success: true, email: email.trim().toLowerCase() };
}

export async function resetPasswordAction(prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = formData.get("email") as string;
  const code = formData.get("code") as string;
  const password = formData.get("password") as string;

  const result = await resetPassword({ email, code, password });

  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
