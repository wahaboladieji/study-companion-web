"use client";

import { useActionState, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { signInAction, signUpAction } from "@/app/actions/auth";

type AuthMode = "signin" | "signup" | "forgot";

function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modeParam = searchParams.get("mode");
  const mode: AuthMode = modeParam === "signup" ? "signup" : modeParam === "forgot" ? "forgot" : "signin";
  const signInEmailRef = useRef<HTMLInputElement>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "signin") signInEmailRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => {
        if (active) setCsrfToken(data.csrfToken ?? null);
      })
      .catch(() => {
        if (active) setCsrfToken(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.title =
      mode === "signin"
        ? "Sign In | AI Study Companion"
        : mode === "signup"
          ? "Sign Up | AI Study Companion"
          : "Reset Password | AI Study Companion";
  }, [mode]);

  const [signInState, signInFormAction, isSignInPending] = useActionState(signInAction, null);
  const [signUpState, signUpFormAction, isSignUpPending] = useActionState(signUpAction, null);

  const [values, setValues] = useState<Record<string, string>>({
    "signin-email": searchParams.get("email") || "",
    "signin-password": "",
    "signup-name": "",
    "signup-email": "",
    "signup-password": "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [valid, setValid] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [hideFooter, setHideFooter] = useState(false);

  const labels: Record<string, string> = {
    "signin-email": "Email",
    "signin-password": "Password",
    "signup-name": "Full Name",
    "signup-email": "Email",
    "signup-password": "Password",
  };

  const validate = (id: string, value: string) => {
    if (!value.trim()) {
      setErrors((prev) => ({ ...prev, [id]: `${labels[id]} field Cannot Be Empty` }));
      setValid((prev) => ({ ...prev, [id]: false }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setValid((prev) => ({ ...prev, [id]: true }));
    }
  };

  const handleChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setTouched((prev) => ({ ...prev, [id]: true }));
    if (id === "signup-name") {
      if (value && /[^a-zA-Z\s]/.test(value)) {
        setErrors((prev) => ({ ...prev, [id]: "Full Name Must Use Only Letters" }));
        setValid((prev) => ({ ...prev, [id]: false }));
      } else if (value.trim() && value.trim().split(/\s+/).length < 2) {
        setErrors((prev) => ({ ...prev, [id]: "Full Name Must Be At Least 2 Words" }));
        setValid((prev) => ({ ...prev, [id]: false }));
      } else if (!value.trim()) {
        setErrors((prev) => ({ ...prev, [id]: `${labels[id]} field Cannot Be Empty` }));
        setValid((prev) => ({ ...prev, [id]: false }));
      } else {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setValid((prev) => ({ ...prev, [id]: true }));
      }
    } else if (id === "signup-email") {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setErrors((prev) => ({ ...prev, [id]: "Enter A Valid Email Address" }));
        setValid((prev) => ({ ...prev, [id]: false }));
      } else if (value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setValid((prev) => ({ ...prev, [id]: true }));
      } else {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setValid((prev) => ({ ...prev, [id]: false }));
      }
    } else if (touched[id]) {
      validate(id, value);
    }
  };

  const handleBlur = (id: string, e?: React.FocusEvent<HTMLInputElement>) => {
    const related = e?.relatedTarget as HTMLElement | null;
    if (related && (related.id === "auth-mode-toggle" || related.id === "auth-forgot-link")) return;
    const trimmed = (values[id] ?? "").trimEnd();
    setValues((prev) => ({ ...prev, [id]: trimmed }));
    setTouched((prev) => ({ ...prev, [id]: true }));
    if (id === "signup-name") {
      if (trimmed && /[^a-zA-Z\s]/.test(trimmed)) {
        setErrors((prev) => ({ ...prev, [id]: "Full Name Must Use Only Letters" }));
      } else if (trimmed.trim() && trimmed.trim().split(/\s+/).length < 2) {
        setErrors((prev) => ({ ...prev, [id]: "Full Name Must Be At Least 2 Words" }));
      } else {
        validate(id, trimmed);
      }
    } else if (id === "signup-email") {
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setErrors((prev) => ({ ...prev, [id]: "Enter A Valid Email Address" }));
        setValid((prev) => ({ ...prev, [id]: false }));
      } else if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setValid((prev) => ({ ...prev, [id]: true }));
      }
    } else {
      validate(id, trimmed);
    }
  };

  const switchMode = (next: AuthMode) => {
    setValues({});
    setTouched({});
    setErrors({});
    setValid({});
    setShowPassword({});
    setHideFooter(false);
    router.replace(`/auth?mode=${next}`);
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    switchMode(mode === "signin" ? "signup" : "signin");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-[var(--spacing-400)]">
      <div className="w-full max-w-[400px] rounded-xl bg-surface p-[var(--spacing-400)] sm:p-[var(--spacing-600)]">
        <div className="flex flex-col items-center text-center">
          <Link href="/" aria-label="Go to homepage">
            <Image src="/icon.svg" alt="" width={40} height={40} priority />
          </Link>
          <h1 className="mt-[var(--spacing-200)] mb-[var(--spacing-50)] text-headline-small text-on-surface">
            {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create an account" : "Reset your password"}
          </h1>
          <p className="text-body-medium text-[var(--primitive-colors-neutral-color-palette-neutral50)]">
            {mode === "signin"
              ? "Enter your credentials to access your account"
              : mode === "signup"
                ? "Enter your details to get started"
                : "We'll help you get back into your account"}
          </p>
        </div>

        {mode === "signin" ? (
          <form action={signInFormAction} className="mt-[var(--spacing-400)] mb-[0.25rem] space-y-[var(--spacing-200)]" onSubmit={(e) => {
            let hasError = false;
            for (const id of ["signin-email", "signin-password"]) {
              setValues((prev) => ({ ...prev, [id]: (prev[id] ?? "").trimEnd() }));
              setTouched((prev) => ({ ...prev, [id]: true }));
              if (!values[id]?.trim()) {
                setErrors((prev) => ({ ...prev, [id]: `${labels[id]} field Cannot Be Empty` }));
                setValid((prev) => ({ ...prev, [id]: false }));
                hasError = true;
              }
            }
            if (hasError) e.preventDefault();
          }}>
            <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
            {signInState?.error && (
              <div className="rounded-md bg-error-container p-[var(--spacing-150)] text-center text-body-medium text-on-error-container">
                {signInState.error}
              </div>
            )}

            <div className="space-y-[var(--spacing-100)]">
              <Label htmlFor="signin-email">Email</Label>
              <Input ref={signInEmailRef} id="signin-email" name="email" type="email" required className="!shadow-none" style={{ ...(errors["signin-email"] ? { border: "1px solid var(--color-error)" } : {}), ...(valid["signin-email"] ? { backgroundColor: "var(--color-primary-container-light)" } : {}) }} value={values["signin-email"] ?? ""} onChange={(e) => handleChange("signin-email", e.target.value)} onBlur={(e) => handleBlur("signin-email", e)} />
              {touched["signin-email"] && errors["signin-email"] && <p className="text-body-small text-error">{errors["signin-email"]}</p>}
            </div>
            <div className="space-y-[var(--spacing-100)]">
              <div className="flex items-center justify-between">
                <Label htmlFor="signin-password">Password</Label>
                <Link id="auth-forgot-link" href={`/auth?mode=forgot${values["signin-email"] ? `&email=${encodeURIComponent(values["signin-email"])}` : ""}`} className="text-label-large text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input id="signin-password" name="password" type={showPassword["signin-password"] ? "text" : "password"} required className="!shadow-none pr-10" style={{ ...(errors["signin-password"] ? { border: "1px solid var(--color-error)" } : {}), ...(valid["signin-password"] ? { backgroundColor: "var(--color-primary-container-light)" } : {}) }} value={values["signin-password"] ?? ""} onChange={(e) => handleChange("signin-password", e.target.value)} onBlur={(e) => handleBlur("signin-password", e)} />
                {values["signin-password"] && (
                  <button type="button" aria-label={showPassword["signin-password"] ? "Hide password" : "Show password"} aria-pressed={showPassword["signin-password"]} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus-visible:outline-none" onClick={() => setShowPassword((prev) => ({ ...prev, "signin-password": !prev["signin-password"] }))}>
                    {showPassword["signin-password"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {touched["signin-password"] && errors["signin-password"] && <p className="text-body-small text-error">{errors["signin-password"]}</p>}
            </div>

            <Button type="submit" className="w-full text-label-large" disabled={isSignInPending || !csrfToken}>
              {isSignInPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        ) : mode === "signup" ? (
          <form action={signUpFormAction} className="mt-[var(--spacing-400)] mb-[0.25rem] space-y-[var(--spacing-200)]" onSubmit={(e) => {
            let hasError = false;
            for (const id of ["signup-name", "signup-email", "signup-password"]) {
              setValues((prev) => ({ ...prev, [id]: (prev[id] ?? "").trimEnd() }));
              setTouched((prev) => ({ ...prev, [id]: true }));
              if (!values[id]?.trim()) {
                setErrors((prev) => ({ ...prev, [id]: `${labels[id]} field Cannot Be Empty` }));
                setValid((prev) => ({ ...prev, [id]: false }));
                hasError = true;
              }
            }
            if (hasError) e.preventDefault();
          }}>
            <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
            <div className="space-y-[var(--spacing-100)]">
              <Label htmlFor="signup-name">Full Name</Label>
              <Input id="signup-name" name="name" type="text" required className="!shadow-none" style={{ ...(errors["signup-name"] ? { border: "1px solid var(--color-error)" } : {}), ...(valid["signup-name"] ? { backgroundColor: "var(--color-primary-container-light)" } : {}) }} value={values["signup-name"] ?? ""} onChange={(e) => handleChange("signup-name", e.target.value)} onBlur={(e) => handleBlur("signup-name", e)} />
              {touched["signup-name"] && errors["signup-name"] && <p className="text-body-small text-error">{errors["signup-name"]}</p>}
            </div>
            <div className="space-y-[var(--spacing-100)]">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" name="email" type="email" required className="!shadow-none" style={{ ...(errors["signup-email"] ? { border: "1px solid var(--color-error)" } : {}), ...(valid["signup-email"] ? { backgroundColor: "var(--color-primary-container-light)" } : {}) }} value={values["signup-email"] ?? ""} onChange={(e) => handleChange("signup-email", e.target.value)} onBlur={(e) => handleBlur("signup-email", e)} />
              {touched["signup-email"] && errors["signup-email"] && <p className="text-body-small text-error">{errors["signup-email"]}</p>}
            </div>
            <div className="space-y-[var(--spacing-100)]">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input id="signup-password" name="password" type={showPassword["signup-password"] ? "text" : "password"} required minLength={8} className="!shadow-none pr-10" style={{ ...(errors["signup-password"] ? { border: "1px solid var(--color-error)" } : {}), ...(valid["signup-password"] ? { backgroundColor: "var(--color-primary-container-light)" } : {}) }} value={values["signup-password"] ?? ""} onChange={(e) => handleChange("signup-password", e.target.value)} onBlur={(e) => handleBlur("signup-password", e)} />
                {values["signup-password"] && (
                  <button type="button" aria-label={showPassword["signup-password"] ? "Hide password" : "Show password"} aria-pressed={showPassword["signup-password"]} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus-visible:outline-none" onClick={() => setShowPassword((prev) => ({ ...prev, "signup-password": !prev["signup-password"] }))}>
                    {showPassword["signup-password"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {touched["signup-password"] && errors["signup-password"] && <p className="text-body-small text-error">{errors["signup-password"]}</p>}
              {values["signup-password"] && (
                <ul className="mt-2 space-y-1 text-body-small">
                  {[
                    { label: "Minimum of 8 characters", met: values["signup-password"].length >= 8 },
                    { label: "Must contain a lowercase letter", met: /[a-z]/.test(values["signup-password"]) },
                    { label: "Must contain an uppercase letter", met: /[A-Z]/.test(values["signup-password"]) },
                    { label: "Must contain a number", met: /[0-9]/.test(values["signup-password"]) },
                    { label: "Must contain a special character (#@>^)", met: /[#@>^]/.test(values["signup-password"]) },
                  ]
                    .filter((req) => !req.met)
                    .map((req) => (
                      <li key={req.label} className="text-on-surface-variant">
                        ○ {req.label}
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {signUpState?.error && (
              <div className="rounded-md bg-error-container p-[var(--spacing-150)] text-body-medium text-on-error-container">
                {signUpState.error}
              </div>
            )}

            <Button type="submit" className="w-full text-label-large" disabled={!csrfToken || isSignUpPending || !values["signup-name"]?.trim() || !values["signup-email"]?.trim() || !values["signup-password"] || !!errors["signup-name"] || !!errors["signup-email"] || !!errors["signup-password"] || values["signup-name"].trim().split(/\s+/).length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values["signup-email"]) || values["signup-password"].length < 8 || !/[a-z]/.test(values["signup-password"]) || !/[A-Z]/.test(values["signup-password"]) || !/[0-9]/.test(values["signup-password"]) || !/[#@>^]/.test(values["signup-password"])}>
              {isSignUpPending ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        ) : (
          <ForgotPasswordForm initialEmail={searchParams.get("email") || ""} onSuccess={() => setHideFooter(true)} />
        )}

        {!hideFooter && (
          <div className="text-center text-body-medium text-[var(--primitive-colors-neutral-color-palette-neutral50)]">
            {mode === "forgot"
              ? "Remembered your password? "
              : mode === "signin"
                ? "Don't have an account? "
                : "Already have an account? "}
            <button id="auth-mode-toggle" type="button" onClick={toggleMode} className="font-medium tracking-[-0.5px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <AuthForm />
    </Suspense>
  );
}
