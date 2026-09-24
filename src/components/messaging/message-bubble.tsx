"use client";
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Copy, Download, FileText, Flag, MoreHorizontal, RotateCw, SmilePlus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatBytes, linkify, summarizeReactions, timeLabel } from "./thread-utils";
import type { AttachmentDTO, MessageDTO, PersonRef } from "./types";

export const REACTIONS = ["👍", "❤️", "🔥", "😂", "🎉", "👀"] as const;

export type DisplayMessage = MessageDTO & { clientId?: string; status?: "sending" | "failed"; error?: string };

export function LinkifiedText({ text, own }: { text: string; own: boolean }) {
  const segments = React.useMemo(() => linkify(text), [text]);
  return (
    <>
      {segments.map((s, i) =>
        s.type === "text" ? (
          <React.Fragment key={i}>{s.value}</React.Fragment>
        ) : (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={cn("[overflow-wrap:anywhere] underline underline-offset-2", own ? "decoration-white/50 hover:decoration-white" : "text-brand-ink decoration-brand/40 hover:decoration-brand")}
          >
            {s.value}
          </a>
        ),
      )}
    </>
  );
}

const downloadHref = (a: AttachmentDTO) => (a.url.startsWith("/uploads/") ? `${a.url}?name=${encodeURIComponent(a.name)}` : a.url);

function Attachments({ items, own }: { items: AttachmentDTO[]; own: boolean }) {
  const images = items.filter((a) => a.mime.startsWith("image/"));
  const files = items.filter((a) => !a.mime.startsWith("image/"));
  return (
    <div className={cn("flex flex-col gap-1.5", own ? "items-end" : "items-start")}>
      {images.length > 0 && (
        <div className={cn("grid gap-1", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {images.map((img) => (
            <a key={img.url} href={img.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-[16px] bg-surface">
              <Image
                src={img.url}
                alt={img.name}
                width={560}
                height={560}
                unoptimized
                className={cn("object-cover", images.length > 1 ? "size-32 sm:size-36" : "h-auto max-h-80 w-auto max-w-[min(18rem,70vw)]")}
              />
            </a>
          ))}
        </div>
      )}
      {files.map((f) => (
        <a
          key={f.url}
          href={downloadHref(f)}
          download={f.name}
          rel="noopener noreferrer"
          className="flex max-w-72 items-center gap-3 rounded-[14px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-surface"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand-ink">
            <FileText className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{f.name}</span>
            <span className="block text-xs text-subtle">{formatBytes(f.size)}</span>
          </span>
          <Download className="size-4 shrink-0 text-muted" aria-label="Download" />
        </a>
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  own,
  startsGroup,
  endsGroup,
  sender,
  showSender,
  avatarColumn,
  showAvatar,
  viewerId,
  selected,
  receipt,
  onSelect,
  onReact,
  onDelete,
  onReport,
  onRetry,
  onDiscard,
}: {
  message: DisplayMessage;
  own: boolean;
  startsGroup: boolean;
  endsGroup: boolean;
  sender: PersonRef | null;
  showSender: boolean;
  /** Group threads reserve a column for sender avatars. */
  avatarColumn: boolean;
  showAvatar: boolean;
  viewerId: string;
  selected: boolean;
  receipt: string | null;
  onSelect: () => void;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  onReport: () => void;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  if (message.kind === "system") {
    return (
      <p className="mx-auto my-3 max-w-sm px-4 text-center text-xs text-subtle" role="note">
        {message.body}
      </p>
    );
  }
  const reactions = summarizeReactions(message.reactions, viewerId, REACTIONS);
  const pending = !!message.status;
  const created = new Date(message.createdAt);
  const hasBody = !message.deleted && message.body.length > 0;
  const hasAttachments = !message.deleted && !!message.attachments?.length;
  const canAct = !pending && !message.deleted;

  const bubbleShape = own
    ? cn("rounded-[20px]", !startsGroup && "rounded-tr-[6px]", !endsGroup && "rounded-br-[6px]")
    : cn("rounded-[20px]", !startsGroup && "rounded-tl-[6px]", !endsGroup && "rounded-bl-[6px]");

  return (
    <div className={cn("group relative flex gap-2", own ? "justify-end" : "justify-start", startsGroup ? "mt-3" : "mt-0.5")}>
      {avatarColumn && !own && (
        <div className="mb-5 w-6 shrink-0 self-end">
          {showAvatar && sender && (
            <Link href={`/people/${sender.handle}`} aria-label={sender.name} tabIndex={-1}>
              <Avatar name={sender.name} src={sender.avatarUrl} size="xs" />
            </Link>
          )}
        </div>
      )}
      <div className={cn("flex max-w-[82%] min-w-0 flex-col sm:max-w-[70%]", own ? "items-end" : "items-start")}>
        {showSender && sender && (
          <Link href={`/people/${sender.handle}`} className="mb-1 ml-3 text-xs font-medium text-muted hover:text-foreground">
            {sender.name}
          </Link>
        )}
        <div className={cn("relative flex items-center gap-1", own ? "flex-row-reverse" : "flex-row")}>
          <div
            className={cn("flex min-w-0 flex-col gap-1", own ? "items-end" : "items-start", pending && "opacity-70")}
            onClick={canAct ? onSelect : undefined}
            title={created.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          >
            {message.deleted ? (
              <div className={cn("border border-dashed border-border-strong px-3.5 py-2 text-sm text-subtle italic", bubbleShape)}>Message deleted</div>
            ) : (
              <>
                {hasAttachments && <Attachments items={message.attachments!} own={own} />}
                {hasBody && (
                  <div
                    className={cn(
                      "px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
                      bubbleShape,
                      own ? "bg-brand text-brand-foreground" : "bg-surface text-foreground",
                    )}
                  >
                    <LinkifiedText text={message.body} own={own} />
                  </div>
                )}
              </>
            )}
          </div>

          {canAct && (
            <div
              className={cn(
                "flex shrink-0 items-center gap-0.5 transition-opacity",
                selected ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100",
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground" aria-label="Add reaction">
                  <SmilePlus className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align={own ? "end" : "start"} side="top" className="flex min-w-0 gap-0.5 rounded-full p-1">
                  {REACTIONS.map((e) => (
                    <DropdownMenuItem key={e} onSelect={() => onReact(e)} className="justify-center rounded-full px-2 py-1.5 text-lg" aria-label={`React ${e}`}>
                      {e}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground" aria-label="Message options">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align={own ? "end" : "start"}>
                  {hasBody && (
                    <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(message.body)}>
                      <Copy /> Copy text
                    </DropdownMenuItem>
                  )}
                  {own ? (
                    <>
                      {hasBody && <DropdownMenuSeparator />}
                      <DropdownMenuItem destructive onSelect={onDelete}>
                        <Trash2 /> Delete message
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onSelect={onReport}>
                      <Flag /> Report message
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {reactions.length > 0 && (
          <div className={cn("-mt-1 flex flex-wrap gap-1", own ? "justify-end pr-2" : "pl-2")}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                aria-pressed={r.mine}
                aria-label={`${r.emoji} ${r.count}${r.mine ? ", including you" : ""}`}
                onClick={() => onReact(r.emoji)}
                className={cn(
                  "relative inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs tabular-nums shadow-soft transition-colors",
                  r.mine ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-border bg-card text-muted hover:text-foreground",
                )}
              >
                <span className="text-[13px] leading-none">{r.emoji}</span>
                {r.count > 1 && r.count}
              </button>
            ))}
          </div>
        )}

        {message.status === "failed" ? (
          <p className="mt-1 flex items-center gap-2 text-xs text-danger" role="alert">
            {message.error ?? "Not sent."}
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
              <RotateCw className="size-3" aria-hidden /> Retry
            </button>
            <button type="button" onClick={onDiscard} className="font-medium text-muted underline-offset-2 hover:underline">
              Discard
            </button>
          </p>
        ) : message.status === "sending" ? (
          <p className="mt-1 text-xs text-subtle">Sending…</p>
        ) : endsGroup ? (
          <p className={cn("mt-1 px-1 text-[11px] text-subtle tabular-nums", own ? "text-right" : "text-left")} suppressHydrationWarning>
            {timeLabel(created)}
            {receipt && <span className="font-medium text-muted"> · {receipt}</span>}
          </p>
        ) : receipt ? (
          <p className="mt-1 px-1 text-[11px] font-medium text-muted">{receipt}</p>
        ) : null}
      </div>
    </div>
  );
}
