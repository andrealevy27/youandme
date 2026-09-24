import { SKILL_CATEGORY_LABELS, STAGE_LABELS, type SkillCategory, type StartupStage } from "../../lib/domain";

/**
 * Deterministic team capability model (pure — no DB). Maps what a startup is building
 * (industries, business model, stage) to the capability categories it needs, then compares
 * that with the union of the team's skill categories.
 *
 * Every reason is built from explicit facts so it can be shown verbatim to a founder.
 */

export type GapSeverity = "critical" | "important" | "nice";
const SEVERITY_RANK: Record<GapSeverity, number> = { critical: 3, important: 2, nice: 1 };

export type CapabilityInput = {
  startup: {
    name: string;
    /** Industry names or slugs ("Health", "b2b-saas"). */
    industries: string[];
    businessModel: string | null;
    stage: StartupStage;
    fundingStatus?: string | null;
    /** Open needs, used to note "you've already listed this". */
    openNeeds?: { title: string; categories: SkillCategory[] }[];
  };
  team: { name: string; skills: { slug: string; category: SkillCategory }[] }[];
};

type Requirement = {
  category: SkillCategory;
  severity: GapSeverity;
  /** Why the startup needs it, phrased as a clause: "Kinwell is an AI product". */
  because: string[];
  /** For domain requirements: specific domain skill slugs that satisfy it. */
  domainSkills?: string[];
  /** Label override (e.g. "Healthcare expertise" rather than "Domain expertise"). */
  label?: string;
};

export type ModelGap = {
  category: SkillCategory;
  label: string;
  severity: GapSeverity;
  reason: string;
  /** Specific skill slugs that close this gap (domain gaps), else empty. */
  skillSlugs: string[];
};

export type CapabilityResult = {
  covered: { category: SkillCategory; label: string; people: string[] }[];
  gaps: ModelGap[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function has(industries: Set<string>, ...keys: string[]) {
  return keys.some((k) => industries.has(k));
}

/** The requirements implied by the startup's own description. Exported for tests. */
export function requiredCapabilities(s: CapabilityInput["startup"]): Requirement[] {
  const ind = new Set(s.industries.map(norm));
  const bm = s.businessModel ? norm(s.businessModel).replace(/-/g, "_") : null;
  const reqs: Requirement[] = [];
  const add = (category: SkillCategory, severity: GapSeverity, because: string, extra: Partial<Requirement> = {}) =>
    reqs.push({ category, severity, because: [because], ...extra });

  const isAI = has(ind, "ai");
  const isSaaS = bm === "b2b_saas" || has(ind, "b2b-saas");
  const isConsumer = bm === "b2c" || has(ind, "consumer", "creator-economy", "gaming", "social-impact");
  const isMarketplace = bm === "marketplace" || has(ind, "marketplaces", "commerce");
  const isHardware = bm === "hardware" || has(ind, "robotics", "hardware");
  const isFintech = bm === "fintech" || has(ind, "fintech");
  const isHealth = has(ind, "health", "biotech");
  const isClimate = has(ind, "climate");
  const isEducation = has(ind, "education");
  const isDevTools = has(ind, "developer-tools");
  const isServices = bm === "services";

  if (isAI) {
    add("ai_ml", "critical", `${s.name} is an AI product`);
    add("engineering", "critical", `${s.name} is an AI product`);
  }
  if (isSaaS) {
    add("engineering", "critical", `${s.name} is B2B SaaS`);
    add("product", "important", `B2B SaaS lives or dies on a sharp product roadmap`);
    add("sales", "important", `B2B SaaS is sold, not just discovered`);
  }
  if (isConsumer) {
    add("design", "important", `consumer products win on experience`);
    add("growth", "important", `consumer products need a repeatable way to acquire users`);
  }
  if (isMarketplace) {
    add("engineering", "critical", `${s.name} is a marketplace`);
    add("growth", "important", `marketplaces have to solve the two-sided cold start`);
    add("operations", "important", `marketplaces need someone running supply and quality`);
  }
  if (isHardware) {
    add("engineering", "critical", `${s.name} builds hardware`);
    add("operations", "important", `hardware needs manufacturing and supply-chain ownership`);
  }
  if (isFintech) {
    add("engineering", "critical", `${s.name} is a fintech product`);
    add("finance", "important", `fintech needs someone fluent in financial products`);
    add("legal", "important", `fintech is regulated (licensing, KYC, money movement)`);
  }
  if (isHealth) {
    add("domain", "critical", `${s.name} is in healthcare`, { domainSkills: ["healthcare"], label: "Healthcare expertise" });
    add("legal", "important", `health data needs compliance ownership (HIPAA, consent, data handling)`, { label: "Compliance & legal" });
  }
  if (isClimate) add("domain", "important", `${s.name} is in climate and energy`, { domainSkills: ["climate-domain"], label: "Climate & energy expertise" });
  if (isEducation) add("domain", "nice", `${s.name} is in education`, { domainSkills: ["education-domain"], label: "Education expertise" });
  if (isFintech) add("domain", "nice", `${s.name} is a fintech product`, { domainSkills: ["fintech-domain"], label: "Financial services expertise" });
  if (isDevTools) {
    add("engineering", "critical", `${s.name} is built for developers`);
    add("growth", "nice", `developer tools grow through community and content`);
  }
  // Baseline: almost every startup ships software.
  if (!isServices && !reqs.some((r) => r.category === "engineering")) {
    add("engineering", "important", `${s.name} needs someone who can build the product`);
  }
  if (["idea", "validation", "prototype"].includes(s.stage)) {
    add("product", "nice", `at the ${STAGE_LABELS[s.stage].toLowerCase()} stage, someone should own customer discovery`);
  }
  if (s.stage === "fundraising" || s.fundingStatus === "raising") {
    add("finance", "important", `${s.name} is fundraising`);
  }
  if (s.stage === "revenue" || s.stage === "growth") {
    add("sales", "important", `${s.name} is at the ${STAGE_LABELS[s.stage].toLowerCase()} stage`);
    add("operations", "nice", `scaling past early revenue needs repeatable operations`);
  }

  // Merge by category (+ domain skill set), keeping the highest severity and all reasons.
  const merged = new Map<string, Requirement>();
  for (const r of reqs) {
    const key = r.category === "domain" ? `domain:${(r.domainSkills ?? []).join(",")}` : r.category;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...r, because: [...r.because] });
      continue;
    }
    if (SEVERITY_RANK[r.severity] > SEVERITY_RANK[prev.severity]) prev.severity = r.severity;
    for (const b of r.because) if (!prev.because.includes(b)) prev.because.push(b);
  }
  return [...merged.values()];
}

function listJoin(items: string[], conj = "and") {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${conj} ${items[items.length - 1]}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Compare requirements with the team's skills. Engineering and AI & ML gaps that occur
 * together are described together ("no one lists Engineering or AI & ML").
 */
export function computeCapabilityGaps(input: CapabilityInput): CapabilityResult {
  const reqs = requiredCapabilities(input.startup);
  const byCategory = new Map<SkillCategory, Set<string>>();
  const slugHolders = new Map<string, Set<string>>();
  for (const m of input.team) {
    for (const s of m.skills) {
      (byCategory.get(s.category) ?? byCategory.set(s.category, new Set()).get(s.category)!).add(m.name);
      (slugHolders.get(s.slug) ?? slugHolders.set(s.slug, new Set()).get(s.slug)!).add(m.name);
    }
  }
  const teamCats = [...byCategory.keys()];
  const covered = teamCats.map((c) => ({ category: c, label: SKILL_CATEGORY_LABELS[c], people: [...byCategory.get(c)!] }));

  const teamPhrase = teamCats.length
    ? `Your team has ${listJoin(teamCats.map((c) => SKILL_CATEGORY_LABELS[c]))} skills`
    : input.team.length
      ? "No one on your team has listed skills yet"
      : "Your team has no members listed yet";

  const missing = reqs.filter((r) => {
    if (r.category === "domain" && r.domainSkills?.length) return !r.domainSkills.some((slug) => slugHolders.has(slug));
    return !byCategory.has(r.category);
  });
  const missingCats = new Set(missing.map((m) => m.category));

  const gaps: ModelGap[] = missing.map((r) => {
    const label = r.label ?? SKILL_CATEGORY_LABELS[r.category];
    let missingPhrase = `no one lists ${label}`;
    // Pair the two technical categories into one sentence when both are missing.
    if (r.category === "engineering" && missingCats.has("ai_ml")) missingPhrase = `no one lists ${SKILL_CATEGORY_LABELS.engineering} or ${SKILL_CATEGORY_LABELS.ai_ml}`;
    if (r.category === "ai_ml" && missingCats.has("engineering")) missingPhrase = `no one lists ${SKILL_CATEGORY_LABELS.ai_ml} or ${SKILL_CATEGORY_LABELS.engineering}`;
    const because = listJoin(r.because);
    let reason = teamCats.length || input.team.length
      ? `${teamPhrase} but ${missingPhrase}, and ${because}.`
      : `${teamPhrase}, and ${because}.`;
    const listed = input.startup.openNeeds?.find((n) => n.categories.includes(r.category));
    if (listed) reason += ` You've already listed an open need for this: "${listed.title}".`;
    return {
      category: r.category,
      label,
      severity: r.severity,
      reason: capitalize(reason),
      skillSlugs: r.category === "domain" ? (r.domainSkills ?? []) : [],
    };
  });

  gaps.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || order(a.category) - order(b.category));
  return { covered, gaps };
}

const ORDER: SkillCategory[] = ["engineering", "ai_ml", "domain", "product", "design", "growth", "sales", "finance", "legal", "business", "operations"];
const order = (c: SkillCategory) => ORDER.indexOf(c);

/** Consultant marketplace categories (slugs) worth considering for a skill-category gap. */
export const CONSULTANT_CATEGORIES_FOR_GAP: Record<SkillCategory, string[]> = {
  engineering: ["software-development"],
  ai_ml: ["ai"],
  design: ["ux-ui", "branding"],
  product: ["product", "market-research"],
  growth: ["growth", "marketing"],
  sales: ["sales"],
  business: ["business-strategy", "market-research"],
  finance: ["fundraising", "finance", "pitch-decks"],
  legal: ["legal"],
  operations: ["operations", "hiring"],
  domain: ["startup-coaching"],
};

/** A one-line summary for cards and the concierge. */
export function summarizeGaps(startupName: string, gaps: ModelGap[]): string {
  if (!gaps.length) return `${startupName}'s team covers the capabilities its stage and market usually need.`;
  const critical = gaps.filter((g) => g.severity === "critical").map((g) => g.label);
  if (critical.length) return `${startupName}'s biggest gaps: ${listJoin(critical)}.`;
  return `${startupName} is missing ${listJoin(gaps.slice(0, 3).map((g) => g.label))}.`;
}
