"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Snackbar } from "@/components/ui/snackbar";

const SNACKBAR_DURATION_MS = 10000;

export function VerificationSuccessSnackbar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isVerified = searchParams.get("verified") === "true";
  const [now, setNow] = useState(() => Date.now());
  const [shownAt, setShownAt] = useState<number | null>(null);
  const cleanedUpRef = useRef(false);

  useEffect(() => {
    if (!isVerified) {
      return;
    }

    const tick = setInterval(() => {
      setNow(Date.now());
      setShownAt((previous) => previous ?? Date.now());
    }, 1000);

    return () => clearInterval(tick);
  }, [isVerified]);

  const elapsed = shownAt === null ? 0 : now - shownAt;
  const show = isVerified && elapsed < SNACKBAR_DURATION_MS;

  useEffect(() => {
    if (!isVerified || cleanedUpRef.current || shownAt === null || now - shownAt < SNACKBAR_DURATION_MS) {
      return;
    }

    cleanedUpRef.current = true;
    const cleaned = new URLSearchParams(
      Array.from(searchParams.entries()).filter(([key]) => key !== "verified"),
    );
    const nextUrl = cleaned.toString() ? `${pathname}?${cleaned.toString()}` : pathname;
    router.replace(nextUrl);
  }, [isVerified, now, shownAt, searchParams, pathname, router]);

  return (
    <Snackbar variant="success" visible={show}>
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Email Verified Successfully!
    </Snackbar>
  );
}
