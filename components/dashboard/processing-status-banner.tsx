"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { getCourseProcessingStatusAction } from "@/app/actions/upload";

type Props = {
  courseId: string;
  initialProcessing: boolean;
};

export function ProcessingStatusBanner({ courseId, initialProcessing }: Props) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(initialProcessing);
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3 | 4>(
    initialProcessing ? 2 : 4
  );
  const [isDismissed, setIsDismissed] = useState(!initialProcessing);
  const pollCountRef = useRef(0);

  // Sync state if initialProcessing becomes true (e.g. user clicked Start Processing)
  useEffect(() => {
    if (initialProcessing) {
      setIsProcessing(true);
      setIsDismissed(false);
      setCurrentStage(2);
      pollCountRef.current = 0;
    }
  }, [initialProcessing]);

  useEffect(() => {
    if (!isProcessing) return;

    // Cycle stage feedback while polling
    const stageTimer = setInterval(() => {
      setCurrentStage((prev) => (prev === 2 ? 3 : 2));
    }, 4000);

    const pollInterval = setInterval(async () => {
      try {
        pollCountRef.current += 1;
        const status = await getCourseProcessingStatusAction(courseId);

        // Wait until all files are READY/FAILED AND a study note has been created,
        // or timeout after ~20 polls (60s) to avoid infinite polling if note generation fails.
        const maxPollsReached = pollCountRef.current >= 20;

        if (status.allReady && (status.hasStudyNote || maxPollsReached)) {
          setIsProcessing(false);
          setCurrentStage(4);

          // Soft refresh the server component so StudyNotesView receives the new note
          router.refresh();

          // Automatically hide the completion banner after 5 seconds
          setTimeout(() => {
            setIsDismissed(true);
          }, 5000);
        }
      } catch (err) {
        console.warn("[ProcessingStatusBanner] Poll error:", err);
      }
    }, 3000);

    return () => {
      clearInterval(stageTimer);
      clearInterval(pollInterval);
    };
  }, [courseId, isProcessing, router]);

  if (isDismissed) {
    return null;
  }

  const renderStageContent = () => {
    switch (currentStage) {
      case 1:
        return {
          icon: <Clock className="h-5 w-5 text-primary animate-pulse" />,
          title: "Queued for AI Processing",
          description: "Your uploaded materials are in line for AI transcription and synthesis.",
        };
      case 2:
        return {
          icon: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
          title: "Transcribing Handwritten Notes & Documents...",
          description: "Extracting text and analyzing your study materials.",
        };
      case 3:
        return {
          icon: <Sparkles className="h-5 w-5 text-primary animate-bounce" />,
          title: "Synthesizing AI Study Guide...",
          description: "Formatting key concepts, summaries, and review topics.",
        };
      case 4:
      default:
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-success" />,
          title: "AI Processing Complete!",
          description: "Your study guide and materials are ready.",
        };
    }
  };

  const stage = renderStageContent();

  return (
    <div className="rounded-xl border border-primary-container/40 bg-primary-container-light/30 p-4 shadow-soft transition-all">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-lowest shadow-sm">
          {stage.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-title-small font-semibold text-on-surface">
              {stage.title}
            </h4>
            {isProcessing && (
              <span className="text-label-small font-medium text-primary bg-primary-container-light px-2 py-0.5 rounded-full">
                Processing
              </span>
            )}
          </div>
          <p className="mt-1 text-body-small text-on-surface-variant">
            {stage.description}
          </p>

          {/* Neutral Progress Stage Indicator */}
          {isProcessing && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  currentStage >= 1 ? "bg-primary" : "bg-outline-variant/30"
                }`}
              />
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  currentStage >= 2 ? "bg-primary" : "bg-outline-variant/30"
                }`}
              />
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  currentStage >= 3 ? "bg-primary" : "bg-outline-variant/30"
                }`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
