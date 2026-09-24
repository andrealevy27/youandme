import {
  AMBITION_LABELS,
  AVAILABILITY,
  COFOUNDER_TYPE_SKILL_CATEGORIES,
  COMMITMENTS,
  SKILL_CATEGORY_LABELS,
  type SkillCategory,
} from "@/lib/domain";
import {
  DIMENSIONS,
  PERSONALITY_FACTOR_DIMENSIONS,
  WORKING_STYLE_FACTOR_DIMENSIONS,
  type DimensionKey,
} from "@/lib/personality";
import type {
  CompatibilityFactor,
  CompatibilityResult,
  CompatibilityScorer,
  FactorKey,
  FrictionPoint,
  MatchProfile,
  MatchWeights,
} from "./types";

/**
 * Rule-based cofounder compatibility (v1).
 *
 * Every factor returns a 0..1 score plus a human-readable detail derived only from
 * structured profile data. Missing data yields a neutral 0.5 flagged `known: false`
 * so it never shows up as a strength or a friction.
 */
export const RULES_VERSION = "rules-v1";

const FACTOR_LABELS: Record<FactorKey, string> = {
  skills: "Skill complementarity",
  goals: "Goal alignment",
  commitment: "Commitment",
  industry: "Industry alignment",
  personality: "Temperament",
  workingStyle: "Working style",
  location: "Location & remote",
  availability: "Time availability",
};

type FactorOutput = { score: number; known: boolean; detail: string; frictions?: FrictionPoint[] };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const categoriesOf = (p: MatchProfile) => new Set(p.skills.map((s) => s.category));
const soughtCategories = (p: MatchProfile) =>
  new Set(p.cofounderTypesSought.flatMap((t) => COFOUNDER_TYPE_SKILL_CATEGORIES[t] ?? []));
const listLabels = (cats: Iterable<SkillCategory>) => [...cats].map((c) => SKILL_CATEGORY_LABELS[c] ?? c);

function joinHuman(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function coverage(needed: Set<SkillCategory>, has: Set<SkillCategory>) {
  if (needed.size === 0) return null;
  let hit = 0;
  for (const c of needed) if (has.has(c)) hit++;
  return hit / needed.size;
}

function skillsFactor(a: MatchProfile, b: MatchProfile): FactorOutput & { complementary: string[] } {
  const aCats = categoriesOf(a);
  const bCats = categoriesOf(b);
  if (aCats.size === 0 || bCats.size === 0) {
    return { score: 0.5, known: false, detail: "Add skills to see how you complement each other.", complementary: [] };
  }
  const aNeeds = soughtCategories(a);
  const bNeeds = soughtCategories(b);
  const aCovered = coverage(aNeeds, bCats);
  const bCovered = coverage(bNeeds, aCats);
  const overlap = [...aCats].filter((c) => bCats.has(c)).length / Math.min(aCats.size, bCats.size);

  const complementaryCats = [...bCats].filter((c) => (aNeeds.size ? aNeeds.has(c) : !aCats.has(c)));
  const complementary = b.skills.filter((s) => complementaryCats.includes(s.category)).map((s) => s.name);

  let score: number;
  if (aCovered === null && bCovered === null) {
    score = 0.35 + 0.65 * (1 - overlap);
  } else {
    score = 0.55 * (aCovered ?? 0.5) + 0.25 * (bCovered ?? 0.5) + 0.2 * (1 - overlap);
  }

  let detail: string;
  if (complementaryCats.length > 0) {
    detail = `${b.name.split(" ")[0]} brings ${joinHuman(listLabels(new Set(complementaryCats)))}${aNeeds.size ? " — skills you said you're looking for" : " — areas you don't cover"}.`;
  } else if (overlap > 0.7) {
    detail = "You have very similar skill sets, so you may end up covering the same ground.";
  } else {
    detail = "Your skills overlap in places and differ in others.";
  }
  const frictions: FrictionPoint[] =
    overlap > 0.8 && (aCovered ?? 0) < 0.5
      ? [{ key: "skills", title: "Overlapping skills", detail: "You both cover similar areas; decide early who owns what." }]
      : [];
  return { score: clamp01(score), known: true, detail, complementary: [...new Set(complementary)].slice(0, 6), frictions };
}

function goalsFactor(a: MatchProfile, b: MatchProfile): FactorOutput {
  if (!a.ambition || !b.ambition) return { score: 0.5, known: false, detail: "Ambitions not shared yet." };
  let ambition: number;
  if (a.ambition === b.ambition) ambition = 1;
  else if (a.ambition === "open" || b.ambition === "open") ambition = 0.7;
  else if (
    (a.ambition === "venture_scale" && b.ambition === "profitable_independent") ||
    (b.ambition === "venture_scale" && a.ambition === "profitable_independent")
  )
    ambition = 0.2;
  else ambition = 0.5;

  const stageOverlap =
    a.stagePreferences.length && b.stagePreferences.length
      ? a.stagePreferences.filter((s) => b.stagePreferences.includes(s)).length > 0
        ? 1
        : 0.3
      : 0.6;
  const score = 0.75 * ambition + 0.25 * stageOverlap;
  const detail =
    a.ambition === b.ambition
      ? `You both want to build a ${AMBITION_LABELS[a.ambition].toLowerCase()}.`
      : `You want a ${AMBITION_LABELS[a.ambition].toLowerCase()}; they lean toward a ${AMBITION_LABELS[b.ambition].toLowerCase()}.`;
  const frictions: FrictionPoint[] =
    ambition <= 0.2
      ? [{ key: "goals", title: "Different end goals", detail: "One of you wants venture scale, the other a profitable independent business. Talk about this first." }]
      : [];
  return { score: clamp01(score), known: true, detail, frictions };
}

function ordinalFactor<T extends string>(
  order: readonly T[],
  a: T | null,
  b: T | null,
  labels: { same: string; close: string; far: string; unknown: string },
  frictionTitle: string,
  key: FactorKey,
): FactorOutput {
  if (!a || !b) return { score: 0.5, known: false, detail: labels.unknown };
  const dist = Math.abs(order.indexOf(a) - order.indexOf(b));
  const score = [1, 0.7, 0.35, 0.1][dist] ?? 0.1;
  const detail = dist === 0 ? labels.same : dist === 1 ? labels.close : labels.far;
  const frictions: FrictionPoint[] = dist >= 2 ? [{ key, title: frictionTitle, detail: labels.far }] : [];
  return { score, known: true, detail, frictions };
}

function industryFactor(a: MatchProfile, b: MatchProfile): FactorOutput & { shared: string[] } {
  if (!a.industries.length || !b.industries.length) {
    return { score: 0.5, known: false, detail: "Industry interests not shared yet.", shared: [] };
  }
  const bSlugs = new Set(b.industries.map((i) => i.slug));
  const shared = a.industries.filter((i) => bSlugs.has(i.slug)).map((i) => i.name);
  const union = new Set([...a.industries.map((i) => i.slug), ...bSlugs]).size;
  const score = shared.length ? 0.6 + 0.4 * (shared.length / union) : 0.2;
  const detail = shared.length
    ? `You're both interested in ${joinHuman(shared.slice(0, 3))}.`
    : "You're drawn to different industries.";
  return { score: clamp01(score), known: true, detail, shared };
}

function dimensionPairScore(dim: DimensionKey, a: number, b: number) {
  const diff = Math.abs(a - b);
  if (DIMENSIONS[dim].pairing === "complement") return clamp01(0.4 + diff / 150);
  return clamp01(1 - diff / 160);
}

function temperamentFactor(a: MatchProfile, b: MatchProfile, dims: DimensionKey[], factorKey: FactorKey): FactorOutput {
  if (!a.personality || !b.personality) {
    return { score: 0.5, known: false, detail: "Take the working-style quiz to unlock this." };
  }
  const scores: number[] = [];
  const frictions: FrictionPoint[] = [];
  const aligned: string[] = [];
  const complemented: string[] = [];
  for (const dim of dims) {
    const av = a.personality[dim];
    const bv = b.personality[dim];
    if (av === undefined || bv === undefined) continue;
    scores.push(dimensionPairScore(dim, av, bv));
    const d = DIMENSIONS[dim];
    const diff = Math.abs(av - bv);
    if (d.pairing === "similar" && diff >= 90) {
      const aPole = av < 0 ? d.left : d.right;
      const bPole = bv < 0 ? d.left : d.right;
      frictions.push({
        key: "personality_dimension",
        title: `${d.left} vs ${d.right}`,
        detail: `You lean ${aPole.toLowerCase()}; they lean ${bPole.toLowerCase()}. Agree how you'll handle this before it comes up.`,
      });
    } else if (d.pairing === "similar" && diff < 40) {
      aligned.push(`${d.left.toLowerCase()} vs ${d.right.toLowerCase()}`);
    } else if (d.pairing === "complement" && diff >= 60) {
      complemented.push(`${d.left.toLowerCase()}/${d.right.toLowerCase()}`);
    }
  }
  if (!scores.length) return { score: 0.5, known: false, detail: "Not enough quiz answers yet." };
  const score = scores.reduce((s, v) => s + v, 0) / scores.length;
  const parts: string[] = [];
  if (complemented.length) parts.push(`you balance each other on ${joinHuman(complemented)}`);
  if (aligned.length) parts.push(`you're aligned on ${joinHuman(aligned)}`);
  const detail = parts.length
    ? `${parts.join("; ").replace(/^./, (c) => c.toUpperCase())}.`
    : factorKey === "workingStyle"
      ? "You'd need to agree on how you work day to day."
      : "Your temperaments differ in a few places.";
  return { score, known: true, detail, frictions };
}

function locationFactor(a: MatchProfile, b: MatchProfile): FactorOutput {
  const remoteish = (m: MatchProfile["workMode"]) => m === "remote" || m === "flexible" || m === "hybrid";
  const sameCity = !!a.city && !!b.city && a.city.toLowerCase() === b.city.toLowerCase();
  const sameCountry = !!a.country && !!b.country && a.country.toLowerCase() === b.country.toLowerCase();
  if (!a.workMode && !b.workMode && !a.city && !b.city) return { score: 0.5, known: false, detail: "Location preferences not shared yet." };
  if (sameCity) return { score: 1, known: true, detail: `You're both in ${a.city}.` };
  if (a.workMode === "remote" && b.workMode === "remote") return { score: 1, known: true, detail: "You both prefer working remotely." };
  if (remoteish(a.workMode) && remoteish(b.workMode)) {
    return { score: sameCountry ? 0.9 : 0.75, known: true, detail: sameCountry ? "Same country and open to remote work." : "You're both open to remote work." };
  }
  if (a.workMode === "in_person" || b.workMode === "in_person") {
    return {
      score: sameCountry ? 0.45 : 0.15,
      known: true,
      detail: "One of you wants to work in person, and you're in different places.",
      frictions: [{ key: "location", title: "Location", detail: "One of you wants to work in person, and you're in different places." }],
    };
  }
  return { score: sameCountry ? 0.7 : 0.5, known: true, detail: sameCountry ? "You're in the same country." : "You're in different locations." };
}

/** Compose factor scores into the final result. Weights are normalised so they needn't sum to 100. */
export function scoreCompatibility(a: MatchProfile, b: MatchProfile, weights: MatchWeights): CompatibilityResult {
  const skills = skillsFactor(a, b);
  const industry = industryFactor(a, b);
  const outputs: Record<FactorKey, FactorOutput> = {
    skills,
    goals: goalsFactor(a, b),
    commitment: ordinalFactor(
      COMMITMENTS,
      a.commitment,
      b.commitment,
      {
        same: a.commitment === "full_time" ? "You both want to build full-time now." : "You're ready to commit at the same level.",
        close: "Your commitment levels are close.",
        far: "You're at different commitment levels right now.",
        unknown: "Commitment level not shared yet.",
      },
      "Commitment gap",
      "commitment",
    ),
    industry,
    personality: temperamentFactor(a, b, PERSONALITY_FACTOR_DIMENSIONS, "personality"),
    workingStyle: temperamentFactor(a, b, WORKING_STYLE_FACTOR_DIMENSIONS, "workingStyle"),
    location: locationFactor(a, b),
    availability: ordinalFactor(
      AVAILABILITY,
      a.availability,
      b.availability,
      {
        same: "You have the same amount of time to give.",
        close: "Your available hours are similar.",
        far: "You have very different amounts of time available.",
        unknown: "Availability not shared yet.",
      },
      "Time availability",
      "availability",
    ),
  };

  const factors: CompatibilityFactor[] = (Object.keys(outputs) as FactorKey[]).map((key) => ({
    key,
    label: FACTOR_LABELS[key],
    score: Math.round(outputs[key].score * 100) / 100,
    weight: weights[key] ?? 0,
    known: outputs[key].known,
    detail: outputs[key].detail,
  }));

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0) || 1;
  const score = Math.round((factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight) * 100);

  const strengths = factors
    .filter((f) => f.known && f.score >= 0.75 && f.weight > 0)
    .sort((x, y) => y.score * y.weight - x.score * x.weight);
  const frictions = (Object.keys(outputs) as FactorKey[])
    .flatMap((k) => outputs[k].frictions ?? [])
    .slice(0, 4);

  return {
    score,
    factors,
    strengths,
    frictions,
    sharedInterests: industry.shared,
    complementarySkills: skills.complementary,
    explanation: explain(score, strengths, a, b),
    algorithmVersion: RULES_VERSION,
  };
}

const STRENGTH_PHRASES: Record<FactorKey, (a: MatchProfile, b: MatchProfile) => string> = {
  skills: () => "your skill sets are highly complementary",
  goals: () => "you share similar long-term ambitions",
  commitment: (a, b) =>
    a.commitment === "full_time" && b.commitment === "full_time" ? "both of you want to build full-time" : "you're ready to commit at the same level",
  industry: () => "you care about the same industries",
  personality: () => "your temperaments balance well",
  workingStyle: () => "you like to work in similar ways",
  location: () => "location works for both of you",
  availability: () => "your available time lines up",
};

export function explain(score: number, strengths: CompatibilityFactor[], a: MatchProfile, b: MatchProfile): string {
  const label = score >= 80 ? "Strong match" : score >= 65 ? "Promising match" : "Possible match";
  const phrases = strengths.slice(0, 3).map((f) => STRENGTH_PHRASES[f.key](a, b));
  if (!phrases.length) {
    return `${label}. There's no standout alignment yet — completing both profiles and the working-style quiz will sharpen this.`;
  }
  return `${label} because ${joinHuman(phrases)}.`;
}

export const rulesScorer: CompatibilityScorer = {
  version: RULES_VERSION,
  score: scoreCompatibility,
};
