/**
 * Pure helpers for the thread UI (no React, no imports) — unit tested in tests/unit/messaging.test.ts.
 */

export type LinkSegment = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING_PUNCT = /[.,;:!?)\]}'"]/;

/** Split text into plain and link segments. Only http(s) links are produced; everything else stays text. */
export function linkify(text: string): LinkSegment[] {
  const out: LinkSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    let raw = match[0];
    const start = match.index ?? 0;
    // Don't swallow sentence punctuation, but keep balanced parentheses (e.g. Wikipedia links).
    while (raw.length && TRAILING_PUNCT.test(raw.at(-1)!)) {
      if (raw.endsWith(")")) {
        const opens = raw.split("(").length - 1;
        const closes = raw.split(")").length - 1;
        if (closes <= opens) break;
      }
      raw = raw.slice(0, -1);
    }
    const href = safeHttpUrl(raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw);
    if (!href) continue;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    out.push({ type: "link", value: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export function safeHttpUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayLabel(date: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type Groupable = { id: string; senderId: string | null; kind: string; createdAt: string };

export type ThreadItem<M> =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; message: M; own: boolean; startsGroup: boolean; endsGroup: boolean };

/** Consecutive messages from the same sender within this window render as one group. */
export const GROUP_WINDOW_MS = 5 * 60_000;

/** Interleave day separators and mark group boundaries. Input must be oldest → newest. */
export function buildThreadItems<M extends Groupable>(messages: M[], viewerId: string, now = new Date()): ThreadItem<M>[] {
  const items: ThreadItem<M>[] = [];
  let prevDay = "";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    const d = new Date(m.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== prevDay) {
      items.push({ kind: "day", key: `day-${dayKey}`, label: dayLabel(d, now) });
      prevDay = dayKey;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sameAs = (o: M | undefined) =>
      !!o &&
      o.kind !== "system" &&
      m.kind !== "system" &&
      o.senderId === m.senderId &&
      Math.abs(new Date(o.createdAt).getTime() - d.getTime()) < GROUP_WINDOW_MS &&
      new Date(o.createdAt).toDateString() === d.toDateString();
    items.push({
      kind: "message",
      key: m.id,
      message: m,
      own: m.senderId === viewerId,
      startsGroup: !sameAs(prev),
      endsGroup: !sameAs(next),
    });
  }
  return items;
}

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

export function summarizeReactions(reactions: { emoji: string; userId: string }[], viewerId: string, order: readonly string[] = []): ReactionSummary[] {
  const map = new Map<string, ReactionSummary>();
  for (const r of reactions) {
    const s = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    s.count += 1;
    if (r.userId === viewerId) s.mine = true;
    map.set(r.emoji, s);
  }
  const rank = (e: string) => (order.indexOf(e) === -1 ? order.length : order.indexOf(e));
  return [...map.values()].sort((a, b) => rank(a.emoji) - rank(b.emoji));
}

/**
 * Read receipt for the viewer's latest message: how many other current members have
 * read up to (or past) it. "Seen" in 1:1 when everyone has, "Seen by N" in groups.
 */
export function seenBy(messageCreatedAt: string, reads: { userId: string; lastReadAt: string | null }[]) {
  const t = new Date(messageCreatedAt).getTime();
  const seen = reads.filter((r) => r.lastReadAt && new Date(r.lastReadAt).getTime() >= t);
  return { seen: seen.length, total: reads.length, userIds: seen.map((r) => r.userId) };
}

export function receiptLabel(seen: number, total: number, isGroup: boolean): string {
  if (total === 0) return "Sent";
  if (!isGroup) return seen >= total ? "Seen" : "Sent";
  if (seen === 0) return "Sent";
  return seen >= total ? "Seen by everyone" : `Seen by ${seen}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Merge polled messages into the current list by id, keeping chronological order. */
export function mergeMessages<M extends { id: string; createdAt: string }>(current: M[], incoming: M[]): M[] {
  if (!incoming.length) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

export function typingLabel(names: string[]): string | null {
  if (!names.length) return null;
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return "Several people are typing";
}
