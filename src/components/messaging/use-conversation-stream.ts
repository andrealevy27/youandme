"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationStateDTO, MessageDTO, MessagesPageDTO } from "./types";
import { mergeMessages } from "./thread-utils";

/**
 * Client side of the realtime abstraction (see `src/server/realtime`). Default transport is
 * short polling: new messages via `?after=` and typing/read/reaction state via `/state`,
 * every 2.5s while the tab is visible, paused when hidden, with backoff on errors.
 * A push transport (Pusher) would plug in here by subscribing to
 * `private-conversation-<id>` and calling `pollNow()` on each event.
 */

export const POLL_INTERVAL_MS = 2500;
/** Re-request a small overlap so a message committed slightly out of order is never missed. */
const OVERLAP_MS = 5000;
const MAX_BACKOFF_MS = 20_000;

export type StreamStatus = "live" | "reconnecting" | "forbidden";

export function useConversationStream(
  conversationId: string,
  initial?: { messages?: MessageDTO[]; hasMore?: boolean; state?: ConversationStateDTO | null },
) {
  const [messages, setMessages] = useState<MessageDTO[]>(initial?.messages ?? []);
  const [state, setState] = useState<ConversationStateDTO | null>(initial?.state ?? null);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [status, setStatus] = useState<StreamStatus>("live");

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const failures = useRef(0);
  const stopped = useRef(false);
  const base = `/api/v1/conversations/${conversationId}`;

  const applyState = useCallback((s: ConversationStateDTO) => {
    setState(s);
    const recent = new Map(s.recent.map((r) => [r.id, r]));
    setMessages((cur) => {
      let changed = false;
      const next = cur.map((m) => {
        const r = recent.get(m.id);
        if (!r) return m;
        const reactionsChanged = JSON.stringify(r.reactions) !== JSON.stringify(m.reactions);
        if (r.deleted === m.deleted && !reactionsChanged) return m;
        changed = true;
        return { ...m, deleted: r.deleted, reactions: r.reactions, ...(r.deleted ? { body: "", attachments: null } : {}) };
      });
      return changed ? next : cur;
    });
  }, []);

  const poll = useCallback(async () => {
    if (inFlight.current || stopped.current) return;
    inFlight.current = true;
    try {
      const latest = messagesRef.current.at(-1)?.createdAt;
      const after = latest ? new Date(new Date(latest).getTime() - OVERLAP_MS).toISOString() : new Date(0).toISOString();
      const [mRes, sRes] = await Promise.all([
        fetch(`${base}/messages?after=${encodeURIComponent(after)}&limit=100`, { cache: "no-store" }),
        fetch(`${base}/state`, { cache: "no-store" }),
      ]);
      if (mRes.status === 401 || mRes.status === 403 || mRes.status === 404) {
        stopped.current = true;
        setStatus("forbidden");
        return;
      }
      if (!mRes.ok || !sRes.ok) throw new Error("poll failed");
      const page = (await mRes.json()) as MessagesPageDTO;
      const s = (await sRes.json()) as ConversationStateDTO;
      if (page.messages.length) setMessages((cur) => mergeMessages(cur, page.messages));
      applyState(s);
      failures.current = 0;
      setStatus("live");
    } catch {
      failures.current += 1;
      if (failures.current >= 2) setStatus("reconnecting");
    } finally {
      inFlight.current = false;
    }
  }, [applyState, base]);

  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);
  const kickRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    stopped.current = false;
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      if (stopped.current || document.visibilityState !== "visible") return;
      const delay = Math.min(POLL_INTERVAL_MS * 2 ** failures.current, MAX_BACKOFF_MS);
      timer.current = setTimeout(async () => {
        await pollRef.current();
        schedule();
      }, delay);
    };
    const kick = async () => {
      await pollRef.current();
      schedule();
    };
    kickRef.current = kick;
    schedule();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void kick();
      else if (timer.current) clearTimeout(timer.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);
    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
  }, [conversationId]);

  /** Poll immediately (e.g. after a push event or reconnect) and reset the timer. */
  const pollNow = useCallback(() => kickRef.current(), []);

  const loadEarlier = useCallback(async () => {
    const oldest = messagesRef.current[0]?.createdAt;
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const res = await fetch(`${base}/messages?before=${encodeURIComponent(oldest)}&limit=50`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const page = (await res.json()) as MessagesPageDTO;
      setMessages((cur) => mergeMessages(cur, page.messages));
      setHasMore(page.hasMore);
    } finally {
      setLoadingEarlier(false);
    }
  }, [base, loadingEarlier]);

  /** Insert/replace a message we already have (e.g. the server's response to our own send). */
  const upsert = useCallback((m: MessageDTO) => setMessages((cur) => mergeMessages(cur, [m])), []);
  const patch = useCallback((id: string, fn: (m: MessageDTO) => MessageDTO) => setMessages((cur) => cur.map((m) => (m.id === id ? fn(m) : m))), []);

  return { messages, state, hasMore, loadingEarlier, loadEarlier, status, pollNow, upsert, patch };
}
