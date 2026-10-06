"use client";

import { BookOpen } from "lucide-react";
import type { StudyNoteSummary } from "@/services/course";

type Props = {
  studyNotes: StudyNoteSummary[];
};

export function StudyNotesView({ studyNotes }: Props) {
  if (!studyNotes || studyNotes.length === 0) {
    return null;
  }

  const latestNote = studyNotes[0];

  return (
    <section className="space-y-[var(--spacing-300)]">
      <div className="rounded-xl border border-surface-container-high bg-surface-lowest p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="text-title-medium font-medium text-on-surface">
              {latestNote.title}
            </h3>
          </div>
          <span className="text-body-small text-outline">
            Updated {new Date(latestNote.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Note Content Display — Normal English paragraphs & H1/H2/H3 hierarchy */}
        <div
          className="prose prose-sm max-w-none text-on-surface leading-relaxed bg-surface-container-lowest/50 p-6 rounded-lg border border-outline-variant/30 overflow-x-auto space-y-4 [&>h1]:text-headline-small [&>h1]:font-bold [&>h1]:text-on-surface [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:text-title-large [&>h2]:font-semibold [&>h2]:text-on-surface [&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:border-b [&>h2]:border-outline-variant/40 [&>h2]:pb-1 [&>h3]:text-title-medium [&>h3]:font-medium [&>h3]:text-primary [&>h3]:mt-4 [&>h3]:mb-1 [&>p]:text-body-medium [&>p]:leading-7 [&>p]:text-on-surface-variant [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-1.5 [&>li]:text-body-medium [&>li]:text-on-surface-variant"
          dangerouslySetInnerHTML={{ __html: latestNote.content }}
        />
      </div>
    </section>
  );
}
