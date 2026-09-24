/**
 * Upload validation — pure functions (no I/O) so they are trivially unit-testable.
 * The declared MIME type is never trusted on its own: the file's leading bytes must
 * match the family we expect, so a renamed executable can't be served as an image.
 */

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const DOCUMENT_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
] as const;
export const ALLOWED_UPLOAD_MIME: readonly string[] = [...IMAGE_MIME, ...DOCUMENT_MIME];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const UPLOAD_PURPOSES = ["message", "avatar", "startup_logo", "portfolio", "document"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/** Purposes that only make sense for images. */
const IMAGE_ONLY_PURPOSES: readonly UploadPurpose[] = ["avatar", "startup_logo"];

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
};

/** Some browsers send an empty or generic type; infer from the file extension as a fallback. */
const BY_EXTENSION: Record<string, string> = Object.fromEntries([
  ...Object.entries(EXTENSIONS).map(([mime, ext]) => [ext, mime]),
  ["jpeg", "image/jpeg"],
]);

export const isImageMime = (mime: string) => (IMAGE_MIME as readonly string[]).includes(mime);
export const extensionFor = (mime: string) => EXTENSIONS[mime] ?? "bin";

export function normalizeMime(declared: string, fileName: string): string {
  const clean = declared.split(";")[0]!.trim().toLowerCase();
  if (clean && clean !== "application/octet-stream") return clean === "image/jpg" ? "image/jpeg" : clean;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? clean;
}

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/** Check magic bytes against the declared type family. */
export function sniffMatches(mime: string, bytes: Uint8Array): boolean {
  switch (mime) {
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
    case "image/webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "application/pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      // OOXML files are ZIP containers.
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case "text/plain": {
      // Reject binaries: no NUL bytes in the first 8KB.
      const n = Math.min(bytes.length, 8192);
      for (let i = 0; i < n; i++) if (bytes[i] === 0) return false;
      return true;
    }
    default:
      return false;
  }
}

export type UploadCheck = { ok: true; mime: string } | { ok: false; error: string };

export function validateUpload(input: { mime: string; name: string; size: number; purpose: UploadPurpose; head: Uint8Array }): UploadCheck {
  const mime = normalizeMime(input.mime, input.name);
  if (!ALLOWED_UPLOAD_MIME.includes(mime)) {
    return { ok: false, error: "That file type isn't supported. Use JPG, PNG, WebP, GIF, PDF, Word, Excel, PowerPoint or plain text." };
  }
  if (IMAGE_ONLY_PURPOSES.includes(input.purpose) && !isImageMime(mime)) {
    return { ok: false, error: "Please choose an image (JPG, PNG, WebP or GIF)." };
  }
  if (input.size <= 0) return { ok: false, error: "That file is empty." };
  const max = isImageMime(mime) ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (input.size > max) {
    return { ok: false, error: `That file is too large. ${isImageMime(mime) ? "Images" : "Files"} can be up to ${max / 1024 / 1024}MB.` };
  }
  if (!sniffMatches(mime, input.head)) return { ok: false, error: "That file doesn't look like a valid " + extensionFor(mime).toUpperCase() + "." };
  return { ok: true, mime };
}

/** Display-safe file name: strips paths and control characters, caps length. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>]/g, "").trim();
  return (cleaned || "file").slice(0, 120);
}

/** Storage keys are random and structured `<purpose>/<yyyy>/<mm>/<uuid>.<ext>`; reject anything else. */
export const STORAGE_KEY_PATTERN = /^[a-z_]+\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z]{2,5}$/;
export const isValidStorageKey = (key: string) => STORAGE_KEY_PATTERN.test(key);

export function makeStorageKey(purpose: UploadPurpose, mime: string, now = new Date(), uuid: string = crypto.randomUUID()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${purpose}/${y}/${m}/${uuid}.${extensionFor(mime)}`;
}
