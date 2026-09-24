"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUp, History, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn, formatRelative } from "@/lib/utils";
import type { ConciergeMessage, ConciergeReply, ConciergeThread } from "@/server/ai/types";
import { MarkdownLite } from "./markdown-lite";
import { ResultCards } from "./result-cards";

export const CONCIERGE_SUGGESTIONS = [
  "I need someone to help with fundraising.",
  "I need a technical cofounder who understands computer vision.",
  "Who should I hire next?",
  "Find me someone who can redesign our onboarding.",
  "What are the biggest gaps in my founding team?",
  "I need a consultant for TikTok growth under $500.",
];

const REQUEST_TIMEOUT_MS = 95_000;
const GENERIC_ERROR = "We couldn't reach You&Me AI. Try again.";

type Failure = { text: string; message: string };

export function ConciergeChat({
  initialThreadId,
  initialMessages,
  threads: initialThreads,
  basicMode,
  initialPrompt,
  viewerName,
}: {
  initialThreadId: string | null;
  initialMessages: ConciergeMessage[];
  threads: ConciergeThread[];
  basicMode: boolean;
  initialPrompt?: string;
  viewerName: string;
}) {
  const [threadId, setThreadId] = React.useState(initialThreadId);
  const [messages, setMessages] = React.useState(initialMessages);
  const [threads, setThreads] = React.useState(initialThreads);
  const [draft, setDraft] = React.useState(initialPrompt ?? "");
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<Failure | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending, failure]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || pending) return;
    setFailure(null);
    setDraft("");
    const tempId = `temp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: "user", content: text, cards: [], createdAt: new Date().toISOString() }]);
    setPending(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("/api/v1/ai", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ threadId, message: text }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as (ConciergeReply & { error?: string }) | null;
      if (!res.ok || !data || data.error) {
        // Rate limits and validation errors carry a human message; anything else is generic.
        const msg = res.status === 429 || res.status === 400 ? (data?.error ?? GENERIC_ERROR) : GENERIC_ERROR;
        throw new Error(msg);
      }
      setMessages((m) => [...m.filter((x) => x.id !== tempId), data.userMessage, data.message]);
      if (data.threadId !== threadId) {
        setThreadId(data.threadId);
        window.history.replaceState(null, "", `/ai?thread=${data.threadId}`);
      }
      setThreads((ts) => {
        const existing = ts.find((t) => t.id === data.threadId);
        const title = existing?.title ?? (text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text);
        return [{ id: data.threadId, title, updatedAt: new Date().toISOString() }, ...ts.filter((t) => t.id !== data.threadId)];
      });
    } catch (err) {
      const message = err instanceof Error && err.name !== "AbortError" && err.message !== "Failed to fetch" ? err.message : GENERIC_ERROR;
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setFailure({ text, message });
      setDraft(text);
    } finally {
      clearTimeout(timer);
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function startNew() {
    // Also reset locally: a thread created in this session keeps the same component instance.
    if (pending) return;
    setThreadId(null);
    setMessages([]);
    setFailure(null);
    setDraft("");
  }

  const empty = messages.length === 0 && !pending;

  return (
    <div className="-mx-4 flex h-[calc(100dvh-12.5rem)] min-h-[440px] overflow-hidden border-y border-border bg-background sm:mx-0 sm:rounded-[20px] sm:border lg:h-[calc(100dvh-5rem)]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/40 lg:flex" aria-label="Recent conversations">
        <ThreadPanel threads={threads} activeId={threadId} />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col" aria-label="You&Me AI conversation">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-gradient text-white">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <h1 className="truncate text-[15px] font-semibold tracking-tight">You&amp;Me AI</h1>
            {basicMode && (
              <span className="hidden truncate rounded-full border border-border px-2.5 py-0.5 text-xs text-muted sm:inline" title="No AI provider is configured on this server.">
                Basic mode — connect an AI provider for richer answers
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Recent conversations">
                  <History />
                </Button>
              </DialogTrigger>
              <DialogContent title="Recent conversations">
                <ThreadPanel threads={threads} activeId={threadId} compact />
              </DialogContent>
            </Dialog>
            <Button asChild variant="ghost" size="sm">
              <Link href="/ai" aria-label="New conversation" onClick={startNew}>
                <Plus /> <span className="hidden sm:inline">New</span>
              </Link>
            </Button>
          </div>
        </header>
        {basicMode && (
          <p className="border-b border-border bg-surface/60 px-4 py-2 text-xs text-muted sm:hidden">Basic mode — connect an AI provider for richer answers</p>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {empty ? (
            <Intro name={viewerName} onPick={send} />
          ) : (
            <ol className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
              {messages.map((m) => (
                <li key={m.id} className={cn("animate-fade-up", m.role === "user" ? "flex justify-end" : "")}>
                  {m.role === "user" ? (
                    <p className="max-w-[85%] rounded-[18px] rounded-br-[6px] bg-ink px-4 py-2.5 text-[15px] whitespace-pre-wrap text-ink-foreground">{m.content}</p>
                  ) : (
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink" aria-hidden>
                        <Sparkles className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="sr-only">You&amp;Me AI said:</span>
                        <MarkdownLite text={m.content} />
                        <ResultCards cards={m.cards} />
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {pending && <Thinking />}
              {failure && (
                <li role="alert" className="rounded-[14px] border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                  <p>{failure.message}</p>
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => send(failure.text)}>
                    Try again
                  </Button>
                </li>
              )}
            </ol>
          )}
          {empty && failure && (
            <div role="alert" className="mx-auto mb-6 max-w-2xl rounded-[14px] border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
              {failure.message}
            </div>
          )}
        </div>

        <form
          className="shrink-0 border-t border-border bg-background px-3 py-3 sm:px-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[16px] border border-border-strong bg-card p-2 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
            <label htmlFor="ai-input" className="sr-only">
              Message You&amp;Me AI
            </label>
            <textarea
              id="ai-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Tell us what you're working on, or who you need…"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed placeholder:text-subtle focus:outline-none field-sizing-content"
            />
            <Button type="submit" size="icon" disabled={!draft.trim() || pending} aria-label="Send">
              <ArrowUp />
            </Button>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl px-1 text-[11px] text-subtle">
            You&amp;Me AI only recommends real members returned by search. It can still be wrong — check profiles before reaching out.
          </p>
        </form>
      </section>
    </div>
  );
}

function Intro({ name, onPick }: { name: string; onPick: (s: string) => void }) {
  const first = name.split(" ")[0];
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-5 py-10">
      <p className="text-sm font-medium text-brand-ink">Hi {first}</p>
      <h2 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">Tell us what you&apos;re working on.</h2>
      <p className="mt-2 text-[15px] text-muted">Ask for a cofounder, a first hire or a consultant. You&amp;Me AI searches the network and tells you who, why, and what to do next.</p>
      <ul className="mt-7 grid gap-2 sm:grid-cols-2">
        {CONCIERGE_SUGGESTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="h-full w-full rounded-[14px] border border-border bg-card px-4 py-3 text-left text-sm shadow-soft transition-all hover:border-border-strong hover:shadow-float focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99]"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thinking() {
  return (
    <li className="flex gap-3" aria-live="polite">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink" aria-hidden>
        <Sparkles className="size-3.5 animate-pulse" />
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <p className="animate-shimmer bg-[linear-gradient(90deg,var(--muted),var(--foreground),var(--muted))] bg-[length:400px_100%] bg-clip-text text-sm font-medium text-transparent">
          Searching the network…
        </p>
        <div className="h-3 w-4/5 animate-shimmer rounded-full bg-surface bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.5),transparent)] bg-[length:400px_100%] bg-no-repeat dark:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.04),transparent)]" />
        <div className="h-3 w-3/5 animate-shimmer rounded-full bg-surface bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.5),transparent)] bg-[length:400px_100%] bg-no-repeat dark:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.04),transparent)]" />
      </div>
    </li>
  );
}

function ThreadPanel({ threads, activeId, compact }: { threads: ConciergeThread[]; activeId: string | null; compact?: boolean }) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", !compact && "p-3")}>
      {!compact && <p className="px-2 pt-1 pb-2 text-xs font-medium text-subtle">Recent conversations</p>}
      {threads.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted">Your conversations with You&amp;Me AI will show up here.</p>
      ) : (
        <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto">
          {threads.map((t) => {
            const active = t.id === activeId;
            return (
              <li key={t.id}>
                <Link
                  href={`/ai?thread=${t.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-[10px] px-3 py-2 text-sm transition-colors",
                    active ? "bg-card text-foreground shadow-soft ring-1 ring-border" : "text-muted hover:bg-surface hover:text-foreground",
                  )}
                >
                  <span className="line-clamp-1">{t.title}</span>
                  <span className="text-xs text-subtle" suppressHydrationWarning>
                    {formatRelative(t.updatedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
