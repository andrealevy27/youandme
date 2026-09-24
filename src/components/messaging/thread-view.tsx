"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ReportDialog } from "@/components/moderation/report-dialog";
import { Composer } from "./composer";
import { INBOX_REFRESH_EVENT } from "./inbox-list";
import { MessageBubble, type DisplayMessage } from "./message-bubble";
import { ThreadHeader } from "./thread-header";
import { buildThreadItems, receiptLabel, seenBy, typingLabel } from "./thread-utils";
import type { AttachmentDTO, ConversationStateDTO, MessageDTO, ThreadDTO } from "./types";
import { useConversationStream } from "./use-conversation-stream";

type Pending = DisplayMessage & { clientId: string };

const NEAR_BOTTOM_PX = 120;

export function ThreadView({
  thread,
  initialMessages,
  initialHasMore,
  initialState,
}: {
  thread: ThreadDTO;
  initialMessages: MessageDTO[];
  initialHasMore: boolean;
  initialState: ConversationStateDTO | null;
}) {
  const router = useRouter();
  const stream = useConversationStream(thread.id, { messages: initialMessages, hasMore: initialHasMore, state: initialState });
  const { messages, state, upsert, patch } = stream;
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reportId, setReportId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);
  const [seenId, setSeenId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const nearBottom = React.useRef(true);
  const prevHeight = React.useRef<number | null>(null);
  const lastReadSent = React.useRef<string | null>(null);

  const isGroup = thread.type === "startup_group" || thread.members.length > 1;
  const viewerId = thread.viewerId;
  const all: DisplayMessage[] = React.useMemo(() => [...messages, ...pending], [messages, pending]);
  const items = React.useMemo(() => buildThreadItems(all, viewerId), [all, viewerId]);

  // Receipt goes under the viewer's newest delivered message.
  const lastOwn = React.useMemo(() => [...messages].reverse().find((m) => m.senderId === viewerId && !m.deleted && m.kind !== "system"), [messages, viewerId]);
  const receipt = React.useMemo(() => {
    if (!lastOwn) return null;
    const reads = state?.reads ?? thread.members.map((m) => ({ userId: m.userId, lastReadAt: m.lastReadAt }));
    const { seen, total } = seenBy(lastOwn.createdAt, reads);
    return { id: lastOwn.id, label: receiptLabel(seen, total, isGroup) };
  }, [lastOwn, state, thread.members, isGroup]);

  const typingNames = (state?.typing ?? []).map((id) => thread.people[id]?.name.split(" ")[0]).filter((n): n is string => !!n);
  const typing = typingLabel(typingNames);

  // ── Read receipts: mark read when a message from someone else arrives while we're looking.
  const newestOther = React.useMemo(() => [...messages].reverse().find((m) => m.senderId !== viewerId), [messages, viewerId]);
  React.useEffect(() => {
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      const key = newestOther?.id ?? "initial";
      if (lastReadSent.current === key) return;
      const first = lastReadSent.current === null;
      lastReadSent.current = key;
      void fetch(`/api/v1/conversations/${thread.id}/read`, { method: "POST" })
        .then(() => {
          window.dispatchEvent(new Event(INBOX_REFRESH_EVENT));
          if (first) router.refresh(); // update unread badges in the app shell
        })
        .catch(() => undefined);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [newestOther?.id, thread.id, router]);

  // ── Scrolling: stick to bottom when already there; keep position when loading history.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }
    const last = all.at(-1);
    if (nearBottom.current || (last && last.senderId === viewerId && last.status === "sending")) el.scrollTop = el.scrollHeight;
  }, [all, viewerId]);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  React.useEffect(() => {
    if (typing && nearBottom.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [typing]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    setAtBottom(nearBottom.current);
    if (nearBottom.current) setSeenId(all.at(-1)?.id ?? null);
  }

  const lastItem = all.at(-1);
  const showJump = !atBottom && !!lastItem && lastItem.id !== seenId && lastItem.senderId !== viewerId && lastItem.kind !== "system";

  async function loadEarlier() {
    const el = scrollRef.current;
    prevHeight.current = el ? el.scrollHeight - el.scrollTop : null;
    try {
      await stream.loadEarlier();
    } catch {
      prevHeight.current = null;
      toast.error("Couldn't load earlier messages.");
    }
  }

  // ── Sending with optimistic UI and retry.
  async function deliver(p: Pending) {
    setPending((cur) => cur.map((x) => (x.clientId === p.clientId ? { ...x, status: "sending", error: undefined } : x)));
    try {
      const res = await fetch(`/api/v1/conversations/${thread.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: p.body, attachments: p.attachments ?? undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: MessageDTO; error?: string };
      if (!res.ok || !data.message) throw new Error(data.error ?? "Not sent.");
      upsert(data.message);
      setPending((cur) => cur.filter((x) => x.clientId !== p.clientId));
      window.dispatchEvent(new Event(INBOX_REFRESH_EVENT));
    } catch (err) {
      const error = err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Not sent — check your connection.";
      setPending((cur) => cur.map((x) => (x.clientId === p.clientId ? { ...x, status: "failed", error } : x)));
    }
  }

  function send(body: string, attachments: AttachmentDTO[]) {
    const clientId = `local-${crypto.randomUUID()}`;
    const p: Pending = {
      id: clientId,
      clientId,
      conversationId: thread.id,
      senderId: viewerId,
      kind: attachments.length ? (attachments.every((a) => a.mime.startsWith("image/")) ? "image" : "file") : "text",
      body,
      attachments: attachments.length ? attachments : null,
      deleted: false,
      createdAt: new Date(Math.max(Date.now(), new Date(messages.at(-1)?.createdAt ?? 0).getTime() + 1)).toISOString(),
      reactions: [],
      status: "sending",
    };
    nearBottom.current = true;
    setPending((cur) => [...cur, p]);
    void deliver(p);
  }

  async function react(messageId: string, emoji: string) {
    const target = messages.find((m) => m.id === messageId);
    if (!target) return;
    const mine = target.reactions.some((r) => r.userId === viewerId && r.emoji === emoji);
    const optimistic = mine
      ? target.reactions.filter((r) => !(r.userId === viewerId && r.emoji === emoji))
      : [...target.reactions, { emoji, userId: viewerId }];
    patch(messageId, (m) => ({ ...m, reactions: optimistic }));
    setSelectedId(null);
    try {
      const res = await fetch(`/api/v1/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = (await res.json()) as { reactions?: { emoji: string; userId: string }[]; error?: string };
      if (!res.ok || !data.reactions) throw new Error(data.error);
      patch(messageId, (m) => ({ ...m, reactions: data.reactions! }));
    } catch (err) {
      patch(messageId, (m) => ({ ...m, reactions: target.reactions }));
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't add that reaction.");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/messages/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error);
      patch(deleteId, (m) => ({ ...m, deleted: true, body: "", attachments: null, reactions: [] }));
      window.dispatchEvent(new Event(INBOX_REFRESH_EVENT));
      setDeleteId(null);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't delete that message.");
    } finally {
      setDeleting(false);
    }
  }

  if (stream.status === "forbidden") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
        <p className="text-[15px] font-medium">This conversation is no longer available</p>
        <p className="mt-1 text-sm text-muted">You may have left it or lost access.</p>
        <Button className="mt-5" size="sm" variant="secondary" onClick={() => router.push("/messages")}>
          Back to messages
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-14 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex flex-col bg-background lg:static lg:inset-auto lg:z-auto lg:h-full lg:bg-card">
      <ThreadHeader thread={thread} typingLabel={typing} />
      {stream.status === "reconnecting" && (
        <p className="flex items-center justify-center gap-1.5 bg-warning-soft py-1.5 text-xs font-medium text-warning" role="status">
          <WifiOff className="size-3.5" aria-hidden /> Reconnecting…
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto overscroll-contain px-3 pt-4 pb-3 sm:px-5"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={`Messages with ${thread.title}`}
        >
          {stream.hasMore ? (
            <div className="mb-2 flex justify-center">
              <Button variant="ghost" size="sm" onClick={loadEarlier} loading={stream.loadingEarlier}>
                Load earlier messages
              </Button>
            </div>
          ) : (
            <ThreadIntro thread={thread} />
          )}
          {items.map((item) =>
            item.kind === "day" ? (
              <div key={item.key} className="my-4 flex items-center gap-3" role="separator" aria-label={item.label}>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium tracking-wide text-subtle uppercase" suppressHydrationWarning>
                  {item.label}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : (
              <MessageBubble
                key={item.key}
                message={item.message}
                own={item.own}
                startsGroup={item.startsGroup}
                endsGroup={item.endsGroup}
                sender={item.message.senderId ? (thread.people[item.message.senderId] ?? null) : null}
                showSender={isGroup && !item.own && item.startsGroup}
                avatarColumn={isGroup}
                showAvatar={item.endsGroup}
                viewerId={viewerId}
                selected={selectedId === item.message.id}
                receipt={receipt && receipt.id === item.message.id ? receipt.label : null}
                onSelect={() => setSelectedId((cur) => (cur === item.message.id ? null : item.message.id))}
                onReact={(emoji) => void react(item.message.id, emoji)}
                onDelete={() => setDeleteId(item.message.id)}
                onReport={() => setReportId(item.message.id)}
                onRetry={() => void deliver(item.message as Pending)}
                onDiscard={() => setPending((cur) => cur.filter((x) => x.clientId !== (item.message as Pending).clientId))}
              />
            ),
          )}
          {typing && (
            <div className="mt-3 flex items-center gap-2 pl-1" aria-live="polite">
              <span className="inline-flex items-center gap-1 rounded-[18px] bg-surface px-3.5 py-3" aria-hidden>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              <span className="sr-only">{typing}</span>
            </div>
          )}
        </div>
        {showJump && (
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            }}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-xs font-medium text-ink-foreground shadow-float"
          >
            <ArrowDown className="size-3.5" aria-hidden /> New messages
          </button>
        )}
      </div>
      <Composer
        conversationId={thread.id}
        onSend={send}
        disabled={thread.blocked}
        disabledReason="You can't reply to this conversation."
      />

      {reportId && (
        <ReportDialog targetType="message" targetId={reportId} open={!!reportId} onOpenChange={(o) => !o && setReportId(null)} />
      )}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent title="Delete this message?" description="It will be removed for everyone in this conversation.">
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThreadIntro({ thread }: { thread: ThreadDTO }) {
  const copy =
    thread.type === "startup_group"
      ? `This is the beginning of the ${thread.startup?.name ?? "team"} team chat.`
      : thread.type === "match"
        ? "You matched. A good first message says why — and suggests a time to talk."
        : thread.type === "booking" || thread.type === "consultant"
          ? "Share context, goals and deadlines here so your session starts fast."
          : `This is the beginning of your conversation with ${thread.title}.`;
  return (
    <div className="mx-auto mt-4 mb-6 max-w-sm text-center">
      <p className="text-sm text-muted">{copy}</p>
    </div>
  );
}
