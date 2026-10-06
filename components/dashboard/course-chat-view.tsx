"use client";

import { useActionState, useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Bot, User, Loader2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { setChatCourseCookie } from "@/components/dashboard/chat-with-ai-tutor-button";
import {
  sendCourseChatMessageAction,
  type SendChatMessageState,
  type ChatMessageItem,
} from "@/app/actions/chat";

type Props = {
  courseId: string;
  hasReadyContent: boolean;
  courses: { id: string; name: string }[];
};

export function CourseChatView({ courseId, hasReadyContent, courses }: Props) {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);
  const [activeCourseIndex, setActiveCourseIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const courseMenuRef = useRef<HTMLDivElement>(null);
  const courseOptionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [state, formAction, isPending] = useActionState<
    SendChatMessageState,
    FormData
  >(sendCourseChatMessageAction, null);

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => setCsrfToken(data.csrfToken ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages, isPending]);

  const messages: ChatMessageItem[] = state?.messages ?? [];

  const selectedCourse = courses.find((course) => course.id === courseId);

  const openCourseMenu = () => {
    const index = courses.findIndex((course) => course.id === courseId);
    setActiveCourseIndex(index >= 0 ? index : 0);
    setIsCourseMenuOpen(true);
  };

  const selectCourseOption = useCallback(
    (nextCourseId: string) => {
      setIsCourseMenuOpen(false);
      if (nextCourseId !== courseId) {
        setChatCourseCookie(nextCourseId);
        router.refresh();
      }
    },
    [courseId, router]
  );

  useEffect(() => {
    if (!isCourseMenuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsCourseMenuOpen(false);
        return;
      }
      if (event.key === "Tab") {
        setIsCourseMenuOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCourseIndex((index) => Math.min(courses.length - 1, index + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCourseIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const course = courses[activeCourseIndex];
        if (course) {
          selectCourseOption(course.id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [activeCourseIndex, courses, isCourseMenuOpen, selectCourseOption]);

  useEffect(() => {
    if (!isCourseMenuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!courseMenuRef.current?.contains(event.target as Node)) {
        setIsCourseMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isCourseMenuOpen]);

  useEffect(() => {
    if (!isCourseMenuOpen) {
      return;
    }
    courseOptionRefs.current[activeCourseIndex]?.scrollIntoView({ block: "nearest" });
  }, [isCourseMenuOpen, activeCourseIndex]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isPending || !csrfToken) return;

    const formData = new FormData();
    formData.set("csrfToken", csrfToken);
    formData.set("courseId", courseId);
    formData.set("message", text);

    setInputMessage("");
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <section
      aria-labelledby="course-chat-heading"
      className="flex h-full flex-col"
    >
      <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col items-center justify-center gap-[var(--spacing-300)] pb-[var(--spacing-600)] text-center">
        <h2
          id="course-chat-heading"
          className="text-title-large font-semibold text-on-surface"
        >
          What would you like to know from your notes?
        </h2>

        {(messages.length > 0 || isPending) && (
          <div className="max-h-[45vh] w-full space-y-4 overflow-y-auto py-[var(--spacing-50)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container-light text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl p-3.5 text-left text-body-medium ${
                    msg.role === "user"
                      ? "bg-primary text-on-primary rounded-br-none"
                      : "bg-surface-container-low text-on-surface border border-outline-variant/30 rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {isPending && (
              <div className="flex items-center justify-start gap-3 text-body-small text-on-surface-variant">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container-light text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 text-left">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Searching course materials and generating answer...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {state?.error && (
          <div
            role="alert"
            className="w-full rounded-lg bg-error-container/20 px-4 py-3 text-left text-body-small text-error"
          >
            {state.error}
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-2 rounded-2xl border border-surface-container-high bg-surface-lowest p-[var(--spacing-100)] shadow-soft"
        >
          <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="message" value={inputMessage} />

          <div ref={courseMenuRef} className="relative max-w-[200px] shrink-0">
            <button
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={isCourseMenuOpen}
              aria-labelledby="chat-course-trigger"
              aria-controls={isCourseMenuOpen ? "chat-course-listbox" : undefined}
              aria-activedescendant={
                isCourseMenuOpen ? `chat-course-option-${activeCourseIndex}` : undefined
              }
              onClick={() => (isCourseMenuOpen ? setIsCourseMenuOpen(false) : openCourseMenu())}
              disabled={isPending}
              className="flex h-[var(--spacing-500)] w-full items-center justify-between gap-[var(--spacing-50)] rounded-md border border-[var(--color-surface-container-high)] bg-surface-container-low px-[var(--spacing-100)] py-[var(--spacing-100)] text-body-small text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span id="chat-course-trigger" className="truncate">
                {selectedCourse?.name ?? "Select course"}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-on-surface-variant transition-transform duration-200",
                  isCourseMenuOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>

            {isCourseMenuOpen && (
              <div
                id="chat-course-listbox"
                role="listbox"
                aria-label="Select course"
                className="absolute inset-x-0 top-full z-20 mt-[var(--spacing-50)] max-h-60 overflow-y-auto rounded-lg border border-outline-variant bg-surface-lowest p-[var(--spacing-50)] shadow-medium animate-dropdown-pop-in"
              >
                {courses.map((course, index) => {
                  const isSelected = course.id === courseId;
                  const isActive = index === activeCourseIndex;
                  return (
                    <div
                      key={course.id}
                      id={`chat-course-option-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      ref={(node) => {
                        courseOptionRefs.current[index] = node;
                      }}
                      onMouseEnter={() => setActiveCourseIndex(index)}
                      onClick={() => selectCourseOption(course.id)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-[var(--spacing-50)] rounded-md px-[var(--spacing-100)] py-[var(--spacing-100)] text-body-small transition-colors",
                        isSelected
                          ? "bg-primary-container-light text-on-primary-container"
                          : "text-on-surface",
                        isActive && !isSelected && "bg-surface-container-low"
                      )}
                    >
                      <span className="truncate">{course.name}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-on-primary-container" aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Input
            type="text"
            placeholder={
              hasReadyContent
                ? "Ask a question about your study materials..."
                : "Process course files first to enable chat"
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={!hasReadyContent || isPending || !csrfToken}
            className="flex-1 text-body-medium placeholder:text-outline"
          />

          <Button
            type="submit"
            disabled={!inputMessage.trim() || !hasReadyContent || isPending || !csrfToken}
            size="sm"
            className="shrink-0"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send Message</span>
          </Button>
        </form>
      </div>
    </section>
  );
}