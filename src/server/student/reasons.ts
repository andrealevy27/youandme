import type { CompatibilityResult } from "../matching/types";
import { schoolBySlug } from "@/lib/schools";
import { weeklyHoursLabel } from "@/lib/student";

/** Student-specific facts not covered by the matching engine's profile. */
export type StudentFacts = {
  name: string;
  school: string | null;
  ideaStatus: string | null;
  ideaSummary: string | null;
  weeklyHours: number | null;
  summerPlans: string | null;
};

const first = (name: string) => name.split(" ")[0] || name;

function joinHuman(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Same hour bucket as the onboarding options (under 5, 5–10, 10–20, 20+). */
function sameHours(a: number | null, b: number | null) {
  return a != null && b != null && weeklyHoursLabel(a) === weeklyHoursLabel(b);
}

/**
 * Plain-language reasons two students fit, most useful first. Built only from facts both people
 * entered — never invented. The first reason is the one-liner shown at events.
 */
export function studentReasons(viewer: StudentFacts, other: StudentFacts, result: CompatibilityResult): string[] {
  const n = first(other.name);
  const out: string[] = [];

  // 1. Idea fit — the single most actionable signal at a team hunt.
  if (viewer.ideaStatus === "have_idea" && other.ideaStatus === "join_one") out.push(`${n} wants to join an idea — and you have one.`);
  else if (viewer.ideaStatus === "join_one" && other.ideaStatus === "have_idea")
    out.push(other.ideaSummary ? `${n} has an idea and needs a team: “${other.ideaSummary}”` : `${n} has an idea and is looking for people to build it.`);

  // 2. Complementary skills.
  if (result.complementarySkills.length) {
    out.push(`${n} brings ${joinHuman(result.complementarySkills.slice(0, 2))} — what you're looking for.`);
  }

  // 3. Same commitment.
  if (sameHours(viewer.weeklyHours, other.weeklyHours)) out.push(`You're both putting in ${weeklyHoursLabel(viewer.weeklyHours)} around classes.`);
  if (viewer.summerPlans === "build" && other.summerPlans === "build") out.push("You both want to build full-time this summer.");

  // 4. Shared interests.
  if (result.sharedInterests.length) out.push(`You both care about ${joinHuman(result.sharedInterests.slice(0, 2))}.`);

  // 5. Campus.
  const school = schoolBySlug(other.school);
  if (school && viewer.school && school.slug !== viewer.school) out.push(`${n} is at ${school.shortName} — a cross-campus team.`);

  // Fallback: the engine's own explanation (also fact-based).
  if (!out.length) out.push(result.explanation);
  return out;
}

/**
 * The single line shown at events: the idea fit (if any) combined with the strongest second fact,
 * so five introductions don't all read the same.
 */
export function oneLineReason(viewer: StudentFacts, other: StudentFacts, result: CompatibilityResult): string {
  const n = first(other.name);
  const wantsToJoin = viewer.ideaStatus === "have_idea" && other.ideaStatus === "join_one";
  if (wantsToJoin) {
    if (result.complementarySkills.length) return `${n} wants to join an idea and brings ${joinHuman(result.complementarySkills.slice(0, 2))} — what you're looking for.`;
    if (sameHours(viewer.weeklyHours, other.weeklyHours)) return `${n} wants to join an idea and has the same ${weeklyHoursLabel(other.weeklyHours)} as you.`;
    if (viewer.summerPlans === "build" && other.summerPlans === "build") return `${n} wants to join an idea and build full-time this summer, like you.`;
    if (result.sharedInterests.length) return `${n} wants to join an idea and also cares about ${joinHuman(result.sharedInterests.slice(0, 2))}.`;
  }
  return studentReasons(viewer, other, result)[0]!;
}

/** "Talk about early" — the engine's friction points, kept to the first two. */
export function talkAboutEarly(result: CompatibilityResult): string[] {
  return result.frictions.slice(0, 2).map((f) => f.detail);
}
