"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Snackbar } from "@/components/ui/snackbar";
import { verifyCodeAction, sendVerificationCodeAction } from "@/app/actions/verification";
import { AuthUser } from "@/services/auth";
import { Mail, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

const SEND_COOLDOWN_SECONDS = 60;
const SNACKBAR_DURATION_MS = 8000;
const DISMISSAL_KEY = "email_verification_dismissed";
const DISMISSAL_EVENT = "email-verification-dismissed";

function subscribeToDismissal(callback: () => void) {
  window.addEventListener(DISMISSAL_EVENT, callback);
  return () => window.removeEventListener(DISMISSAL_EVENT, callback);
}

function getDismissedSnapshot() {
  return window.sessionStorage.getItem(DISMISSAL_KEY) === "1";
}

function getServerDismissedSnapshot() {
  return false;
}

function CodeInput({
  onCodeChange,
}: {
  onCodeChange: (code: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array.from({ length: 5 }, () => ""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
    onCodeChange("");
  }, [onCodeChange]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    onCodeChange(next.join(""));
    if (value.slice(-1) && index < 4) {
      refs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 5);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: 5 }, (_, i) => pasted[i] ?? "");
    setDigits(next);
    onCodeChange(pasted);
    const focusIndex = pasted.length >= 5 ? 4 : pasted.length;
    refs.current[focusIndex]?.focus();
  }

  return (
    <div className="flex gap-[var(--spacing-100)]" role="group" aria-label="Verification code digits">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          aria-label={`Digit ${i + 1}`}
          className="h-[var(--spacing-500)] w-[var(--spacing-500)] rounded-md border border-surface-container-high bg-surface-lowest text-center font-mono text-title-large shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      ))}
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) {
    return email;
  }
  const first = local[0];
  const last = local[local.length - 1];
  const masked = `${first}${'*'.repeat(Math.min(local.length - 2, 5))}${last}`;
  return `${masked}@${domain}`;
}

export function VerificationBanner({ user }: { user: AuthUser }) {
  const [verifyState, verifyFormAction, isVerifying] = useActionState(verifyCodeAction, null);
  const [sendState, sendFormAction, isSending] = useActionState(sendVerificationCodeAction, null);
  const [now, setNow] = useState(() => Date.now());
  const dismissed = useSyncExternalStore(subscribeToDismissal, getDismissedSnapshot, getServerDismissedSnapshot);
  const router = useRouter();
  const codeSent = sendState?.success === true;
  const sentAt = codeSent ? sendState.sentAt ?? 0 : 0;
  const [combinedCode, setCombinedCode] = useState("");

  const CODE_EXPIRY_SECONDS = 120;

  useEffect(() => {
    if (verifyState?.success) {
      router.push("?verified=true");
      router.refresh();
    }
  }, [verifyState, router]);

  useEffect(() => {
    if (!sentAt) {
      return;
    }

    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [sentAt]);

  const elapsedSeconds = sentAt ? Math.floor((now - sentAt) / 1000) : 0;
  const countdown = sentAt ? Math.max(0, SEND_COOLDOWN_SECONDS - elapsedSeconds) : 0;
  const showSnackbar = sentAt !== 0 && elapsedSeconds < SNACKBAR_DURATION_MS / 1000;
  const codeExpired = sentAt !== 0 && elapsedSeconds >= CODE_EXPIRY_SECONDS;

  if (user.emailVerified || dismissed) {
    return null;
  }

  const sendDisabled = isSending || countdown > 0;

  return (
    <div className="relative mb-[var(--spacing-400)] rounded-xl border border-primary-container bg-primary-container-light p-[var(--spacing-200)]">
      <button
        type="button"
        onClick={() => {
          window.sessionStorage.setItem(DISMISSAL_KEY, "1");
          window.dispatchEvent(new Event(DISMISSAL_EVENT));
        }}
        aria-label="Dismiss"
        className="absolute right-[var(--spacing-100)] top-[var(--spacing-100)] flex h-[var(--spacing-400)] w-[var(--spacing-400)] items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-[var(--spacing-300)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-title-medium text-on-surface">Verify your email</h3>

          {!codeSent ? (
            /* ── Initial state: no code sent yet ── */
            <>
              <p className="mt-1 text-body-medium text-on-surface-variant">
                We&apos;ll send a verification code to <strong>{maskEmail(user.email)}</strong>. Click the button below to send it.
              </p>
              <form action={sendFormAction} className="mt-[var(--spacing-300)]">
                <Button type="submit" disabled={sendDisabled} className="shrink-0">
                  {isSending
                    ? "Sending..."
                    : countdown > 0
                      ? `Send verification code (${countdown}s)`
                      : "Send verification code"}
                </Button>

                {sendState?.error && (
                  <div className="mt-[var(--spacing-200)] flex items-center gap-1.5 text-body-medium text-error">
                    <AlertCircle className="h-4 w-4" />
                    <span>{sendState.error}</span>
                  </div>
                )}
              </form>
            </>
          ) : codeExpired ? (
            /* ── Expired state: hide input + verify, show resend + error ── */
            <>
              <div className="mt-1 flex items-center gap-1.5 text-body-medium text-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>The verification code has expired</span>
              </div>

              <form action={sendFormAction} className="mt-[var(--spacing-300)] shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  disabled={sendDisabled}
                  className={
                    sendDisabled
                      ? "bg-surface-container-high"
                      : "bg-primary text-on-primary hover:opacity-90"
                  }
                >
                  {isSending
                    ? "Resending..."
                    : countdown > 0
                      ? `Resend code (${countdown}s)`
                      : "Resend code"}
                </Button>
              </form>
            </>
          ) : (
            /* ── Active state: code sent and still valid ── */
            <>
              <p className="mt-1 text-body-medium text-on-surface-variant">
                A verification code has been sent to <strong>{user.email}</strong>. Enter it below to verify your email.
              </p>
              <div className="mt-[var(--spacing-150)]">
                <form action={verifyFormAction} className="max-w-sm">
                  <input type="hidden" name="code" value={combinedCode} />
                  <div className="flex items-end gap-[var(--spacing-100)]">
                    <CodeInput key={sentAt} onCodeChange={setCombinedCode} />
                    <Button type="submit" disabled={isVerifying || combinedCode.length < 5} className="shrink-0">
                      {isVerifying ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </form>

                <div className="mt-[var(--spacing-150)] flex flex-col gap-[var(--spacing-100)]">
                  {verifyState?.error && (
                    <div className="flex items-center gap-1.5 text-body-medium text-error">
                      <AlertCircle className="h-4 w-4" />
                      <span>{verifyState.error}</span>
                    </div>
                  )}

                  <form action={sendFormAction} className="shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="submit"
                      disabled={sendDisabled}
                      className={
                        sendDisabled
                          ? "bg-surface-container-high"
                          : "bg-primary text-on-primary hover:opacity-90"
                      }
                    >
                      {isSending
                        ? "Resending..."
                        : countdown > 0
                          ? `Resend code (${countdown}s)`
                          : "Resend code"}
                    </Button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Snackbar visible={showSnackbar}>
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Verification Code Sent! Check Email
      </Snackbar>
    </div>
  );
}
