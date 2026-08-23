import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";

export default async function ChatPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-[var(--spacing-800)]">
      <div className="flex flex-col items-center text-center max-w-md space-y-[var(--spacing-300)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
          <MessageCircle className="h-8 w-8" />
        </div>

        <div className="space-y-[var(--spacing-100)]">
          <h1 className="text-headline-small text-on-surface">
            AI Chat
          </h1>
          <p className="text-body-medium text-on-surface-variant">
            Chat with your course materials using AI. Ask questions about your
            uploaded documents and get grounded, source-backed answers.
          </p>
        </div>

        <div className="w-full rounded-xl border border-dashed border-outline p-[var(--spacing-400)] text-center">
          <p className="text-label-large text-on-surface-variant">
            Select a course to start chatting
          </p>
          <p className="mt-[var(--spacing-50)] text-body-small text-on-surface-variant/60">
            Your conversations will be grounded in the course&apos;s uploaded materials.
          </p>
        </div>
      </div>
    </div>
  );
}
