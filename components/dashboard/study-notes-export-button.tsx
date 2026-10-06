"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudyNoteSummary } from "@/services/course";

type Props = {
  note: StudyNoteSummary;
};

export function StudyNotesExportButton({ note }: Props) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showMenu) {
      return;
    }

    const firstItem = containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowMenu(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMenu]);

  const stripHtml = (html: string): string => {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();
  };

  const closeMenu = () => setShowMenu(false);

  const handleCopy = () => {
    const plainText = stripHtml(note.content);
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
    closeMenu();
  };

  const handlePrintPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${note.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 30px; color: #111; }
          h1 { font-size: 24px; border-bottom: 2px solid #ccc; padding-bottom: 8px; }
          h2 { font-size: 20px; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          h3 { font-size: 16px; margin-top: 18px; color: #2563eb; }
          p { font-size: 14px; margin: 12px 0; }
          ul { padding-left: 20px; }
          li { margin: 6px 0; }
        </style>
      </head>
      <body>
        ${note.content}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
    closeMenu();
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        className="border border-outline-variant gap-[var(--spacing-75)] pl-[var(--spacing-150)]"
        onClick={() => setShowMenu(!showMenu)}
        aria-expanded={showMenu}
        aria-haspopup="menu"
      >
        <Download className="h-4 w-4" />
        Export
      </Button>

      {showMenu && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 rounded-lg border border-surface-container-high bg-surface-lowest p-1 shadow-md z-20"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            className="w-full flex items-center gap-2 px-3 py-2 text-label-medium text-on-surface hover:bg-surface-container-low rounded-md transition-colors text-left"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4 text-outline" />
            )}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handlePrintPdf}
            className="w-full flex items-center gap-2 px-3 py-2 text-label-medium text-on-surface hover:bg-surface-container-low rounded-md transition-colors text-left"
          >
            <Save className="h-4 w-4 text-outline" />
            Save as PDF
          </button>
        </div>
      )}
    </div>
  );
}
