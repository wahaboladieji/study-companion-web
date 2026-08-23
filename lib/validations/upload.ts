export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per PRD Section 14

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

const ACCEPTED_EXTENSIONS = Object.values(ALLOWED_FILE_TYPES).flat();

export type UploadValidationResult =
  | { ok: true; fileType: string }
  | { ok: false; error: string };

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1 || dot === fileName.length - 1) {
    return "";
  }
  return fileName.slice(dot + 1).toLowerCase();
}

export function validateUploadFile(fileName: string, mimeType: string, size: number): UploadValidationResult {
  if (size <= 0) {
    return { ok: false, error: "Empty files cannot be uploaded." };
  }

  if (size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      ok: false,
      error: `Files must be 20MB or smaller. "${fileName}" is too large.`,
    };
  }

  const extension = getFileExtension(fileName);
  const mimeAllowed = Object.prototype.hasOwnProperty.call(ALLOWED_FILE_TYPES, mimeType);
  const extensionAllowed = ACCEPTED_EXTENSIONS.includes(extension);

  if (!mimeAllowed || !extensionAllowed) {
    return {
      ok: false,
      error: `"${fileName}" is not a supported file type. Use PDF, DOCX, PPTX, JPG, JPEG, or PNG.`,
    };
  }

  const matchedTypes = ALLOWED_FILE_TYPES[mimeType];
  if (!matchedTypes.includes(extension)) {
    return {
      ok: false,
      error: `"${fileName}" has a file extension that does not match its content type.`,
    };
  }

  return { ok: true, fileType: mimeType };
}

export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 255) || "unnamed-file";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
