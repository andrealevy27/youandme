/**
 * Rule-based "describe what you need" interpreter. Pure and deterministic —
 * used directly in basic mode and as the fallback/validator for the AI path.
 */
// Relative import keeps this pure module loadable without path aliases (unit tests).
import { STARTUP_STAGES, type StartupStage } from "../../lib/domain";

export type CategoryHint = { slug: string; name: string; keywords: string[] };

export type InterpretedNeed = {
  categorySlugs: string[];
  keywords: string[];
  maxBudgetCents: number | null;
  stage?: StartupStage;
};

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could do does for from get got has have help helping how i if in into is it its " +
    "just let like looking me my need needs needed of on or our ours out really so some someone somebody something that the their " +
    "them then there these they this those to up us use want wants we were what when where which who will with would you your " +
    "about also any anyone around build building expert experts experience find good great hire hiring person people please " +
    "should startup startups company team work working next month months week weeks year years new make making under below less than " +
    "max maximum budget within dollars usd per hour hourly price around approx approximately best right now soon asap"
  ).split(/\s+/),
);

const STAGE_PATTERNS: [RegExp, StartupStage][] = [
  [/\bpre[\s-]?revenue\b/, "pre_revenue"],
  [/\b(just an idea|idea stage|at the idea|an idea)\b/, "idea"],
  [/\b(validat(e|ing|ion)|customer discovery)\b/, "validation"],
  [/\bprototyp(e|ing)\b/, "prototype"],
  [/\bmvp\b/, "mvp"],
  [/\b(paying customers|first revenue|generating revenue|have revenue|making revenue)\b/, "revenue"],
  [/\b(scaling|scale up|series a)\b/, "growth"],
  [/\b(raising|fundrais(e|ing)|pre[\s-]?seed|seed round)\b/, "fundraising"],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function phraseRegex(phrase: string) {
  // Allow simple English suffixes so "launching" matches "launch" and "investors" matches "investor".
  return new RegExp(`(^|[^a-z0-9])${escapeRe(phrase.toLowerCase())}(s|es|ing|ed|er|ers)?($|[^a-z0-9])`);
}

/** Generic words that appear in many requests; they count, but weakly. */
const WEAK_TERMS = new Set(["build", "app", "mvp", "users", "team", "founder", "model", "process", "social", "launch", "design", "code", "product"]);

/** Parse "under $500", "up to $2k", "budget of 1,500", "<$300", "$800 max" → cents. */
export function parseBudgetCents(text: string): number | null {
  const t = text.toLowerCase().replace(/ /g, " ");
  const amount = String.raw`[$€£]?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|thousand)?`;
  const patterns = [
    new RegExp(String.raw`(?:under|below|less than|up to|upto|at most|no more than|max(?:imum)?|budget(?:\s+(?:of|is|around|about))?:?|within|<=?|cap(?:ped)? at)\s*(?:of\s*)?${amount}`),
    new RegExp(String.raw`${amount}\s*(?:max(?:imum)?|budget|or less|tops|cap)\b`),
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (!m) continue;
    const raw = Number(m[1]!.replace(/,/g, ""));
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const dollars = m[2] ? raw * 1000 : raw;
    if (dollars > 10_000_000) continue;
    return Math.round(dollars * 100);
  }
  return null;
}

export function parseStage(text: string): StartupStage | undefined {
  const t = text.toLowerCase();
  for (const [re, stage] of STAGE_PATTERNS) if (re.test(t)) return stage;
  return undefined;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+k?$/.test(w));
}

/** Score categories by keyword/name hits; returns slugs ordered by strength (max 3). */
export function matchCategories(text: string, categories: CategoryHint[]): { slug: string; hits: string[]; score: number }[] {
  const t = ` ${text.toLowerCase()} `;
  const scored = categories
    .map((c) => {
      const names = new Set([c.name.toLowerCase(), c.slug.replace(/-/g, " ")]);
      const terms = [...new Set([...names, ...c.keywords.map((k) => k.toLowerCase())])];
      const hits = terms.filter((k) => k.length >= 2 && phraseRegex(k).test(t));
      const score = hits.reduce((sum, h) => sum + (WEAK_TERMS.has(h) ? 0.4 : names.has(h) ? 1.5 : 1), 0);
      return { slug: c.slug, hits, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  const top = scored[0]?.score ?? 0;
  // Keep only categories reasonably close to the best match.
  return scored.filter((c) => c.score >= Math.max(0.8, top * 0.45)).slice(0, 3);
}

export function interpretNeedRules(text: string, categories: CategoryHint[]): InterpretedNeed {
  const clean = text.slice(0, 2000);
  const cats = matchCategories(clean, categories);
  const tokens = tokenize(clean);
  const keywords = [...new Set([...cats.flatMap((c) => c.hits.filter((h) => !h.includes(" "))), ...tokens])].slice(0, 10);
  const stage = parseStage(clean);
  return {
    categorySlugs: cats.map((c) => c.slug),
    keywords,
    maxBudgetCents: parseBudgetCents(clean),
    ...(stage ? { stage } : {}),
  };
}

export function isStartupStage(s: string): s is StartupStage {
  return (STARTUP_STAGES as readonly string[]).includes(s);
}
