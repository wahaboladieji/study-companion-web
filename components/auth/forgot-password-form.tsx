"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/app/actions/auth";

type ResetStep = "request" | "reset" | "done";

const PASSWORD_RULES = [
  { label: "Minimum of 8 characters", met: (v: string) => v.length >= 8 },
  { label: "Must contain a lowercase letter", met: (v: string) => /[a-z]/.test(v) },
  { label: "Must contain an uppercase letter", met: (v: string) => /[A-Z]/.test(v) },
  { label: "Must contain a number", met: (v: string) => /[0-9]/.test(v) },
  { label: "Must contain a special character (#@>^)", met: (v: string) => /[#@>^]/.test(v) },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEP_LABELS: Record<ResetStep, string> = {
  request: "Step 1 of 3",
  reset: "Step 2 of 3",
  done: "Step 3 of 3",
};

export function ForgotPasswordForm({ initialEmail = "", onSuccess }: { initialEmail?: string, onSuccess?: () => void }) {
  const [step, setStep] = useState<ResetStep>("request");

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isRequestPending, setRequestPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState(false);

  const [isResetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const requestCode = async (emailValue: string): Promise<boolean> => {
    const fd = new FormData();
    fd.set("email", emailValue);
    setRequestPending(true);
    setRequestError(null);
    try {
      const result = await requestPasswordResetAction(null, fd);
      if (!result?.success) {
        setRequestError(result?.error ?? "Something went wrong. Please try again.");
        return false;
      }
      return true;
    } catch {
      setRequestError("Something went wrong. Please try again.");
      return false;
    } finally {
      setRequestPending(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    setEmail(trimmed);
    if (!EMAIL_REGEX.test(trimmed)) {
      setErrors({ email: "Enter A Valid Email Address" });
      return;
    }
    const ok = await requestCode(trimmed);
    if (ok) {
      setErrors({});
      setStep("reset");
    }
  };

  const handleResend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ok = await requestCode(email);
    if (ok) {
      setResendNote(true);
    }
  };

  const handleBackToRequest = () => {
    setCode("");
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setErrors({});
    setResetError(null);
    setResendNote(false);
    setStep("request");
  };

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    const next: Record<string, string> = {};
    if (!/^\d{5}$/.test(code)) next.code = "Enter The 5-Digit Code";
    if (!password) next.password = "Password field Cannot Be Empty";
    else if (!PASSWORD_RULES.every((r) => r.met(password))) next.password = "Password Does Not Meet All Requirements";
    if (!confirm) next.confirm = "Confirm Your Password";
    else if (confirm !== password) next.confirm = "Passwords Do Not Match";

    if (Object.keys(next).length > 0) {
      e.preventDefault();
      setErrors(next);
      return;
    }

    e.preventDefault();
    setErrors({});
    setResetError(null);
    setResetPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const result = await resetPasswordAction(null, fd);
      if (!result?.success) {
        setResetError(result?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStep("done");
      if (onSuccess) onSuccess();
    } catch {
      setResetError("Something went wrong. Please try again.");
    } finally {
      setResetPending(false);
    }
  };

  const passwordMet = PASSWORD_RULES.every((r) => r.met(password));
  const canSubmitReset = /^\d{5}$/.test(code) && passwordMet && confirm === password && confirm.length > 0;

  return (
    <div className="mt-[var(--spacing-400)]">
      <p className="mb-[var(--spacing-200)] text-label-small text-on-surface-variant">
        {STEP_LABELS[step]}
      </p>

      {step === "request" && (
        <form onSubmit={handleRequestSubmit} className="space-y-[var(--spacing-200)]">
          <p className="text-body-medium text-[var(--primitive-colors-neutral-color-palette-neutral50)]">
            Enter the email you signed up with and we&apos;ll send you a 5-digit reset code.
          </p>

          <div className="space-y-[var(--spacing-100)]">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="!shadow-none"
              style={{ ...(errors.email ? { border: "1px solid var(--color-error)" } : {}) }}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
              }}
            />
            {errors.email && <p className="text-body-small text-error">{errors.email}</p>}
          </div>

          {requestError && (
            <div className="rounded-md bg-error-container p-[var(--spacing-150)] text-body-medium text-on-error-container">
              {requestError}
            </div>
          )}

          <Button type="submit" className="w-full mb-[0.25rem] text-label-large" disabled={isRequestPending || !email.trim()}>
            {isRequestPending ? "Sending code..." : "Send Reset Code"}
          </Button>
        </form>
      )}

      {step === "reset" && (
        <>
          <form onSubmit={handleResetSubmit} className="space-y-[var(--spacing-200)]">
            <p className="text-body-medium text-[var(--primitive-colors-neutral-color-palette-neutral50)]">
              We sent a 5-digit code to <span className="font-medium text-on-surface">{email}</span>. Enter it below with your new password.
            </p>

            <input type="hidden" name="email" value={email} />

            <div className="space-y-[var(--spacing-100)]">
              <Label htmlFor="reset-code">Reset code</Label>
              <Input
                id="reset-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className="!shadow-none"
                style={{ ...(errors.code ? { border: "1px solid var(--color-error)" } : {}) }}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 5));
                  if (errors.code) setErrors((prev) => ({ ...prev, code: "" }));
                }}
              />
              {errors.code && <p className="text-body-small text-error">{errors.code}</p>}
            </div>

            <div className="space-y-[var(--spacing-100)]">
              <Label htmlFor="reset-password">New password</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="!shadow-none pr-10"
                  style={{ ...(errors.password ? { border: "1px solid var(--color-error)" } : {}) }}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                  }}
                />
                {password && (
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus-visible:outline-none"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {errors.password && <p className="text-body-small text-error">{errors.password}</p>}
              {password && (
                <ul className="space-y-1 text-body-small">
                  {PASSWORD_RULES.filter((r) => !r.met(password)).map((r) => (
                    <li key={r.label} className="text-on-surface-variant">
                      ○ {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-[var(--spacing-100)]">
              <Label htmlFor="reset-confirm">Confirm password</Label>
              <div className="relative">
                <Input
                  id="reset-confirm"
                  name="confirm"
                  type={showPassword ? "text" : "password"}
                  required
                  className="!shadow-none pr-10"
                  style={{ ...(errors.confirm ? { border: "1px solid var(--color-error)" } : {}) }}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: "" }));
                  }}
                />
                {confirm && (
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide confirm password" : "Show confirm password"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus-visible:outline-none"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {errors.confirm && <p className="text-body-small text-error">{errors.confirm}</p>}
            </div>

            {resetError && (
              <div className="rounded-md bg-error-container p-[var(--spacing-150)] text-body-medium text-on-error-container">
                {resetError}
              </div>
            )}
            {requestError && (
              <div className="rounded-md bg-error-container p-[var(--spacing-150)] text-body-medium text-on-error-container">
                {requestError}
              </div>
            )}

            <Button type="submit" className="w-full mb-[0.25rem] text-label-large" disabled={isResetPending || !canSubmitReset}>
              {isResetPending ? "Resetting..." : "Reset Password"}
            </Button>
          </form>

          <div className="mt-[var(--spacing-200)] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBackToRequest}
              className="inline-flex items-center gap-1 text-label-large text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="text-right">
              {resendNote && (
                <p className="mb-1 text-body-small text-on-surface-variant">
                  Code resent to {email}.
                </p>
              )}
              <form onSubmit={handleResend}>
                <input type="hidden" name="email" value={email} />
                <button
                  type="submit"
                  disabled={isRequestPending}
                  className="text-label-large text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm disabled:opacity-50"
                >
                  {isRequestPending ? "Sending..." : "Resend code"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center text-center">
          <div className="flex h-[var(--spacing-600)] w-[var(--spacing-600)] items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="mt-[var(--spacing-200)] text-headline-small text-on-surface">
            Password updated
          </h2>
          <p className="mt-[var(--spacing-50)] text-body-medium text-[var(--primitive-colors-neutral-color-palette-neutral50)]">
            Your password has been changed. Sign in with your new password.
          </p>
          <Link
            href={`/auth?mode=signin&email=${encodeURIComponent(email)}`}
            className="mt-[var(--spacing-300)] flex h-[var(--spacing-500)] w-full items-center justify-center rounded-md bg-primary px-[var(--spacing-200)] py-[var(--spacing-100)] text-label-large text-on-primary transition-all hover:opacity-90 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Sign In
          </Link>
        </div>
      )}
    </div>
  );
}
