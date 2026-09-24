import type { SkillCategory } from "../../lib/domain";

/**
 * Pure query understanding for keyword search. No database access, so it is unit-testable
 * and reusable by the AI concierge's basic mode.
 *
 * A query like "AI engineer at NYU interested in health startups" becomes:
 *   categories  → ai_ml, engineering      (boost people with skills in those categories)
 *   industries  → Health                  (boost people who care about that industry)
 *   universities→ NYU                     (boost alumni)
 *   text        → "ai engineer nyu health" (OR-ed full-text query, filler removed)
 */

export const SEARCH_TABS = ["people", "founders", "cofounders", "talent"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export type VocabSkill = { id: string; slug: string; name: string; category: string };
export type VocabIndustry = { id: string; slug: string; name: string };

export type ExtractedTerms = {
  skillIds: string[];
  skillNames: string[];
  categories: SkillCategory[];
  industryIds: string[];
  industryNames: string[];
  universities: string[];
  /** Free text with filler words removed; used for the OR-ed full-text query. */
  text: string;
};

/** Words that carry no search signal in natural-language asks. */
const FILLER = new Set(
  (
    "a an the and or of for to in on at by with from into about who whom that which what someone somebody anyone person people " +
    "me my our we us i you your find need want looking look search show get help can could would should will is are be been " +
    "interested interest startup startups company companies team please some any one like work working works job role " +
    "under over than more less best good great really very just also new next our who's someone's"
  ).split(/\s+/),
);

/** Natural-language words that imply a skill category even without naming a skill. */
export const CATEGORY_SYNONYMS: Record<string, SkillCategory[]> = {
  ai: ["ai_ml"],
  ml: ["ai_ml"],
  "machine learning": ["ai_ml"],
  llm: ["ai_ml"],
  llms: ["ai_ml"],
  "data scientist": ["ai_ml"],
  technical: ["engineering", "ai_ml"],
  engineer: ["engineering"],
  engineers: ["engineering"],
  engineering: ["engineering"],
  developer: ["engineering"],
  developers: ["engineering"],
  dev: ["engineering"],
  coder: ["engineering"],
  programmer: ["engineering"],
  software: ["engineering"],
  cto: ["engineering"],
  designer: ["design"],
  designers: ["design"],
  design: ["design"],
  redesign: ["design"],
  ux: ["design"],
  ui: ["design"],
  onboarding: ["design", "product"],
  "product manager": ["product"],
  pm: ["product"],
  growth: ["growth"],
  marketing: ["growth"],
  marketer: ["growth"],
  tiktok: ["growth"],
  sales: ["sales"],
  seller: ["sales"],
  fundraising: ["finance"],
  finance: ["finance"],
  cfo: ["finance"],
  legal: ["legal"],
  lawyer: ["legal"],
  compliance: ["legal"],
  operations: ["operations"],
  ops: ["operations"],
  operator: ["operations"],
  business: ["business"],
  commercial: ["business", "sales"],
  strategy: ["business"],
};

/** Generic trailing words stripped from skill names to get a matchable stem ("Backend engineering" → "backend"). */
const GENERIC_SKILL_WORDS = new Set(["development", "engineering", "design", "domain", "marketing", "management", "applications"]);

/** Skill stems too generic to count as a skill mention on their own. */
const AMBIGUOUS_STEMS = new Set(["product", "data", "ui", "financial", "user", "brand", "content", "social"]);

export function normalize(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9$&+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word (phrase) containment on normalized text. Hyphens and spaces are interchangeable. */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const p = normalize(phrase).replace(/-/g, " ");
  if (!p) return false;
  const h = ` ${haystack.replace(/-/g, " ")} `;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(p)}([^a-z0-9]|$)`).test(h);
}

function skillPhrases(s: VocabSkill): string[] {
  const name = normalize(s.name);
  const phrases = new Set([name, s.slug.replace(/-/g, " ")]);
  const words = name.split(" ");
  if (words.length > 1 && GENERIC_SKILL_WORDS.has(words[words.length - 1]!)) {
    const stem = words.slice(0, -1).join(" ");
    if (!AMBIGUOUS_STEMS.has(stem) && stem.length >= 3) phrases.add(stem);
  }
  return [...phrases].filter((p) => p.length >= 2);
}

function industryPhrases(i: VocabIndustry): string[] {
  const name = normalize(i.name);
  const out = new Set([name, i.slug.replace(/-/g, " ")]);
  if (name === "health") out.add("healthcare").add("health care").add("medical");
  if (name === "climate") out.add("energy").add("sustainability");
  if (name === "education") out.add("edtech");
  if (name === "fintech") out.add("finance").add("payments");
  if (name === "marketplaces") out.add("marketplace");
  if (name === "consumer") out.add("b2c");
  if (name === "b2b saas") out.add("saas").add("b2b");
  return [...out];
}

/** Common short forms. University names are matched verbatim or by these acronyms. */
const UNIVERSITY_ALIASES: Record<string, string[]> = {
  nyu: ["new york university"],
  mit: ["massachusetts institute of technology"],
  ucla: ["university of california, los angeles"],
  cmu: ["carnegie mellon"],
  "georgia tech": ["georgia institute of technology"],
};

function acronym(name: string) {
  return normalize(name)
    .split(" ")
    .filter((w) => w.length > 2 && !["of", "and", "the"].includes(w))
    .map((w) => w[0])
    .join("");
}

/** Match known university names (from profiles) against the query. */
export function matchUniversities(query: string, universities: string[]): string[] {
  const q = normalize(query);
  const hits = new Set<string>();
  for (const u of universities) {
    const n = normalize(u);
    if (!n) continue;
    const short = n.replace(/^(the )?university of /, "").replace(/ university$/, "");
    const aliases = Object.entries(UNIVERSITY_ALIASES)
      .filter(([k, full]) => k === n || full.some((f) => n.includes(f)))
      .map(([k]) => k);
    const candidates = [n, ...(short.length >= 4 ? [short] : []), ...aliases];
    const acr = acronym(u);
    if (acr.length >= 3 && n.split(" ").length >= 2) candidates.push(acr);
    if (candidates.some((c) => containsPhrase(q, c))) hits.add(u);
  }
  return [...hits];
}

export function extractSearchTerms(
  query: string,
  vocab: { skills: VocabSkill[]; industries: VocabIndustry[]; universities?: string[] },
): ExtractedTerms {
  const q = normalize(query);
  const skillHits = vocab.skills.filter((s) => skillPhrases(s).some((p) => containsPhrase(q, p)));
  const industryHits = vocab.industries.filter((i) => industryPhrases(i).some((p) => containsPhrase(q, p)));
  const categories = new Set<SkillCategory>();
  for (const [phrase, cats] of Object.entries(CATEGORY_SYNONYMS)) {
    if (containsPhrase(q, phrase)) cats.forEach((c) => categories.add(c));
  }
  const text = q
    .replace(/\$\s?\d[\d,.]*k?/g, " ")
    .split(/[\s]+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9+#]+$/g, ""))
    .filter((w) => w.length > 1 && !FILLER.has(w))
    .join(" ");
  return {
    skillIds: skillHits.map((s) => s.id),
    skillNames: skillHits.map((s) => s.name),
    categories: [...categories],
    industryIds: industryHits.map((i) => i.id),
    industryNames: industryHits.map((i) => i.name),
    universities: vocab.universities ? matchUniversities(query, vocab.universities) : [],
    text,
  };
}

/** Offset cursor encoding (opaque to clients). */
export function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`).toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(cursor, "base64url").toString();
    const n = Number(raw.startsWith("o:") ? raw.slice(2) : NaN);
    return Number.isInteger(n) && n >= 0 && n < 10_000 ? n : 0;
  } catch {
    return 0;
  }
}
