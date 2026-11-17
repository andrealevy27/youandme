/** Student-mode vocabulary. Stored as text so options can change without a migration. */

type Opt<K extends string> = readonly { key: K; label: string; hint?: string }[];

export const CLASS_YEARS = [
  { key: "freshman", label: "Freshman" },
  { key: "sophomore", label: "Sophomore" },
  { key: "junior", label: "Junior" },
  { key: "senior", label: "Senior" },
  { key: "masters", label: "Master's" },
  { key: "mba", label: "MBA" },
  { key: "phd", label: "PhD" },
  { key: "alum", label: "Recent grad" },
] as const satisfies Opt<string>;
export type ClassYear = (typeof CLASS_YEARS)[number]["key"];

export const IDEA_STATUSES = [
  { key: "have_idea", label: "I have an idea", hint: "Looking for people to build it with." },
  { key: "join_one", label: "I want to join one", hint: "I'll bring my skills to someone else's idea." },
  { key: "open", label: "Open to both", hint: "Happy to pitch or to join." },
] as const satisfies Opt<string>;
export type IdeaStatus = (typeof IDEA_STATUSES)[number]["key"];

/** Stored value is a representative number of hours, so similarity can be measured. */
export const WEEKLY_HOURS = [
  { key: "3", label: "Under 5 hrs", hint: "Exploring for now" },
  { key: "8", label: "5–10 hrs", hint: "A real side project" },
  { key: "15", label: "10–20 hrs", hint: "My main thing after classes" },
  { key: "25", label: "20+ hrs", hint: "Basically a second major" },
] as const satisfies Opt<string>;

export const SUMMER_PLANS = [
  { key: "build", label: "Build the startup full-time" },
  { key: "internship", label: "Internship, building on the side" },
  { key: "undecided", label: "Not sure yet" },
  { key: "graduating", label: "Graduating — going all in after" },
] as const satisfies Opt<string>;
export type SummerPlan = (typeof SUMMER_PLANS)[number]["key"];

export const labelOf = (opts: readonly { key: string; label: string }[], key: string | null | undefined) =>
  opts.find((o) => o.key === key)?.label ?? null;

export function weeklyHoursLabel(h: number | null | undefined): string | null {
  if (h == null) return null;
  if (h < 5) return "under 5 hrs/week";
  if (h <= 10) return "5–10 hrs/week";
  if (h <= 20) return "10–20 hrs/week";
  return "20+ hrs/week";
}

/** The short working-style quiz: one statement per dimension (keys from src/lib/personality.ts). */
export const SHORT_QUIZ_KEYS = ["vision_story", "decide_gut", "plan_weekly", "solo_deep", "risk_bet", "conflict_direct", "details_ship"] as const;
