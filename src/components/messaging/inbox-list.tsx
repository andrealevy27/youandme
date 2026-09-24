"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BellOff, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatRelative } from "@/lib/utils";
import { AvatarStack } from "./avatar-stack";
import type { InboxFilter, InboxItemDTO } from "./types";

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "matches", label: "Matches" },
  { key: "consultants", label: "Consultants" },
  { key: "startups", label: "Startups" },
  { key: "direct", label: "Direct" },
];

const EMPTY_COPY: Record<Exclude<InboxFilter, "all">, string> = {
  matches: "When you and a cofounder match, your conversation lands here.",
  consultants: "Conversations with consultants and booking threads show up here.",
  startups: "Team chats for startups you're part of appear here.",
  direct: "Direct messages you start from someone's profile show up here.",
};

export const INBOX_REFRESH_EVENT = "ym:inbox-refresh";
const INBOX_POLL_MS = 10_000;

/** Conversation list with filter tabs. Refreshes every 10s while visible and whenever a thread signals a change. */
export function InboxList({ initial }: { initial: InboxItemDTO[] }) {
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;
  const [items, setItems] = React.useState(initial);
  const [filter, setFilter] = React.useState<InboxFilter>("all");
  const [now, setNow] = React.useState(() => new Date());

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/conversations?limit=100", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: InboxItemDTO[] };
      setItems(data.conversations);
      setNow(new Date());
    } catch {
      // Offline — keep showing what we have.
    }
  }, []);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => document.visibilityState === "visible" && void refresh(), INBOX_POLL_MS);
    };
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    start();
    window.addEventListener(INBOX_REFRESH_EVENT, refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener(INBOX_REFRESH_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Opening a thread marks it read — reflect that immediately.
  const visible = items
    .map((c) => (c.id === activeId && c.unread ? { ...c, unread: 0 } : c))
    .filter((c) => filter === "all" || c.filter === filter);
  const unreadByFilter = (key: InboxFilter) => items.filter((c) => c.unread > 0 && c.id !== activeId && (key === "all" || c.filter === key)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Filter conversations" className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3">
        {FILTERS.map((f) => {
          const n = unreadByFilter(f.key);
          const selected = filter === f.key;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
                selected ? "bg-ink text-ink-foreground" : "bg-surface text-muted hover:text-foreground",
              )}
            >
              {f.label}
              {n > 0 && (
                <span className={cn("size-1.5 rounded-full", selected ? "bg-ink-foreground" : "bg-brand")} aria-label={`${n} unread`} />
              )}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
            <MessageCircle className="size-5" aria-hidden />
          </span>
          <h2 className="text-[15px] font-semibold">No conversations yet</h2>
          <p className="mt-1.5 max-w-xs text-sm text-muted">
            Match with a cofounder or reach out to a consultant — your conversations will live here.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/matches">See your matches</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/consultants">Find a consultant</Link>
            </Button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted">{filter !== "all" && EMPTY_COPY[filter]}</p>
      ) : (
        <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2" aria-label="Conversations">
          {visible.map((c) => (
            <li key={c.id}>
              <InboxRow item={c} active={c.id === activeId} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxRow({ item, active, now }: { item: InboxItemDTO; active: boolean; now: Date }) {
  const unread = item.unread > 0;
  const preview = item.lastMessage ? `${item.lastMessage.fromViewer ? "You: " : ""}${item.lastMessage.preview}` : "No messages yet — say hello";
  return (
    <Link
      href={`/messages/${item.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[14px] px-2.5 py-2.5 transition-colors",
        active ? "bg-surface" : "hover:bg-surface/70 active:bg-surface",
      )}
    >
      <AvatarStack people={item.avatars} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-[15px]", unread ? "font-semibold" : "font-medium")}>{item.title}</span>
          <time dateTime={item.lastMessageAt} className={cn("shrink-0 text-xs tabular-nums", unread ? "text-foreground" : "text-subtle")} suppressHydrationWarning>
            {formatRelative(item.lastMessage?.createdAt ?? item.lastMessageAt, now)}
          </time>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-[13px]", unread ? "text-foreground" : "text-muted")}>{preview}</span>
          {item.muted && <BellOff className="size-3.5 shrink-0 text-subtle" aria-label="Muted" />}
          {unread && (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground tabular-nums">
              {item.unread > 99 ? "99+" : item.unread}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
