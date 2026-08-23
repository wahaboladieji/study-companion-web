"use client";

import { useEffect, useRef, useState } from "react";
import lottie from "lottie-web";
import confettiData from "@/public/animations/confetti.json";

export function ConfettiCelebration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    window.history.replaceState({}, "", window.location.pathname);

    if (!containerRef.current) {
      return;
    }

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: false,
      autoplay: true,
      animationData: confettiData,
    });

    const handleComplete = () => setDone(true);
    anim.addEventListener("complete", handleComplete);

    return () => {
      anim.removeEventListener("complete", handleComplete);
      anim.destroy();
    };
  }, []);

  if (done) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
    >
      <div ref={containerRef} className="h-[420px] w-full max-w-[720px]" />
    </div>
  );
}
