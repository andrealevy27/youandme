/**
 * Pure: choose which tool-returned entities become result cards under an answer.
 * Cards are ALWAYS a subset of what tools returned — the model can never add one.
 * Keep entities whose exact name appears in the final text; if none are mentioned,
 * fall back to the top results of the most recent search.
 */
export type CardCandidate = { kind: "person" | "consultant" | "startup"; id: string; name: string };

function mentions(text: string, name: string) {
  const n = name.trim().toLowerCase();
  if (n.length < 2) return false;
  const t = text.toLowerCase();
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, "u").test(t);
}

export function selectCards(
  text: string,
  collected: CardCandidate[],
  lastResults: CardCandidate[],
  opts: { max?: number; fallback?: number } = {},
): CardCandidate[] {
  const max = opts.max ?? 6;
  const seen = new Set<string>();
  const out: CardCandidate[] = [];
  for (const c of collected) {
    // One card per entity: a consultant is also a person — whichever a tool returned first wins.
    const key = c.id;
    if (seen.has(key) || !mentions(text, c.name)) continue;
    seen.add(key);
    out.push(c);
  }
  // Order by first mention in the text, so cards follow the answer.
  const lower = text.toLowerCase();
  out.sort((a, b) => lower.indexOf(a.name.toLowerCase()) - lower.indexOf(b.name.toLowerCase()));
  if (out.length) return out.slice(0, max);
  return lastResults.slice(0, opts.fallback ?? 3);
}
