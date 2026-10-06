"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";

type Props = {
  courseId: string;
};

const COURSE_COOKIE_NAME = "chat-course";
const COURSE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function setChatCourseCookie(courseId: string) {
  document.cookie = `${COURSE_COOKIE_NAME}=${encodeURIComponent(courseId)}; path=/; max-age=${COURSE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function ChatWithAiTutorButton({ courseId }: Props) {
  const router = useRouter();

  const handleClick = () => {
    setChatCourseCookie(courseId);
    router.push("/dashboard/chat");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed bottom-[var(--spacing-400)] right-[var(--spacing-400)] z-40 inline-flex items-center gap-[var(--spacing-100)] rounded-full bg-primary px-[var(--spacing-300)] py-[var(--spacing-150)] text-label-medium text-on-primary shadow-soft transition-all hover:opacity-90 hover:shadow-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      <span>Chat with AI Tutor</span>
    </button>
  );
}