"use client";
import * as React from "react";
import Image from "next/image";
import { ArrowUp, FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBytes } from "./thread-utils";
import type { AttachmentDTO } from "./types";

const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".txt",
].join(",");
const MAX_ATTACHMENTS = 5;
const TYPING_THROTTLE_MS = 3000;

type Draft = { id: string; name: string; size: number; mime: string; previewUrl: string | null; status: "uploading" | "ready" | "failed"; uploaded?: AttachmentDTO; error?: string };

export async function uploadFile(file: File, purpose = "message"): Promise<AttachmentDTO> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  const res = await fetch("/api/v1/uploads", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as Partial<AttachmentDTO> & { error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed. Please try again.");
  return { url: data.url, name: data.name ?? file.name, size: data.size ?? file.size, mime: data.mime ?? file.type };
}

/**
 * Autosizing composer. Enter sends, Shift+Enter adds a newline. Attachments upload
 * immediately so sending is instant; typing pings are throttled to one per 3s.
 */
export function Composer({
  conversationId,
  disabled,
  disabledReason,
  onSend,
}: {
  conversationId: string;
  disabled?: boolean;
  disabledReason?: string;
  onSend: (body: string, attachments: AttachmentDTO[]) => void;
}) {
  const [body, setBody] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const lastTyping = React.useRef(0);
  const inputId = React.useId();

  // Revoke object URLs when drafts go away.
  const draftsRef = React.useRef(drafts);
  React.useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  React.useEffect(() => () => draftsRef.current.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl)), []);

  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [body]);

  function pingTyping() {
    const now = Date.now();
    if (now - lastTyping.current < TYPING_THROTTLE_MS) return;
    lastTyping.current = now;
    void fetch(`/api/v1/conversations/${conversationId}/typing`, { method: "POST" }).catch(() => undefined);
  }

  async function addFiles(files: FileList | File[]) {
    const list = [...files].slice(0, MAX_ATTACHMENTS - drafts.length);
    if (files.length > list.length) toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
    const created: { draft: Draft; file: File }[] = list.map((file) => ({
      file,
      draft: {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mime: file.type,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        status: "uploading",
      },
    }));
    setDrafts((d) => [...d, ...created.map((c) => c.draft)]);
    await Promise.all(
      created.map(async ({ draft, file }) => {
        try {
          const uploaded = await uploadFile(file);
          setDrafts((d) => d.map((x) => (x.id === draft.id ? { ...x, status: "ready", uploaded } : x)));
        } catch (err) {
          const error = err instanceof Error ? err.message : "Upload failed.";
          toast.error(error);
          setDrafts((d) => d.map((x) => (x.id === draft.id ? { ...x, status: "failed", error } : x)));
        }
      }),
    );
  }

  function removeDraft(id: string) {
    setDrafts((d) => {
      const target = d.find((x) => x.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return d.filter((x) => x.id !== id);
    });
  }

  const uploading = drafts.some((d) => d.status === "uploading");
  const ready = drafts.filter((d) => d.status === "ready" && d.uploaded).map((d) => d.uploaded!);
  const canSend = !disabled && !uploading && (body.trim().length > 0 || ready.length > 0);

  function submit() {
    if (!canSend) return;
    onSend(body.trim(), ready);
    setBody("");
    drafts.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
    setDrafts([]);
    lastTyping.current = 0;
    textareaRef.current?.focus();
  }

  if (disabled) {
    return (
      <div className="border-t border-border px-4 py-4 text-center text-sm text-muted">{disabledReason ?? "You can't reply to this conversation."}</div>
    );
  }

  return (
    <form
      className="border-t border-border bg-background/95 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:bg-card lg:pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
      }}
    >
      {drafts.length > 0 && (
        <ul className="scrollbar-none mb-2 flex gap-2 overflow-x-auto" aria-label="Attachments">
          {drafts.map((d) => (
            <li key={d.id} className="relative shrink-0">
              {d.previewUrl ? (
                <Image src={d.previewUrl} alt={d.name} width={64} height={64} unoptimized className="size-16 rounded-[12px] object-cover" />
              ) : (
                <span className="flex h-16 w-44 items-center gap-2 rounded-[12px] border border-border bg-card px-2.5">
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{d.name}</span>
                    <span className="block text-[11px] text-subtle">{formatBytes(d.size)}</span>
                  </span>
                </span>
              )}
              {d.status === "uploading" && (
                <span className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/35">
                  <Loader2 className="size-4 animate-spin text-white" aria-label="Uploading" />
                </span>
              )}
              {d.status === "failed" && (
                <span className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-danger/80 px-1 text-center text-[10px] font-medium text-white">
                  Failed
                </span>
              )}
              <button
                type="button"
                onClick={() => removeDraft(d.id)}
                aria-label={`Remove ${d.name}`}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-ink-foreground shadow"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={drafts.length >= MAX_ATTACHMENTS}
          aria-label="Attach a file"
          className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-40"
        >
          <Paperclip className="size-[18px]" />
        </button>
        <label htmlFor={inputId} className="sr-only">
          Message
        </label>
        <textarea
          id={inputId}
          ref={textareaRef}
          rows={1}
          value={body}
          maxLength={5000}
          placeholder="Write a message"
          enterKeyHint="send"
          onChange={(e) => {
            setBody(e.target.value);
            if (e.target.value.trim()) pingTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            const files = [...e.clipboardData.files];
            if (files.length) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-[20px] border border-border-strong bg-card px-4 py-2 text-[15px] leading-6 text-foreground placeholder:text-subtle focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-95",
            canSend ? "bg-brand text-brand-foreground" : "bg-surface text-subtle",
          )}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
        </button>
      </div>
    </form>
  );
}
