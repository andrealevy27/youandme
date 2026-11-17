import { inArray } from "drizzle-orm";
import { db } from "../db";
import { profiles } from "../db/schema";
import type { CompatibilityResult } from "../matching/types";
import { studentReasons, type StudentFacts } from "./reasons";

export async function loadStudentFacts(ids: string[]): Promise<Map<string, StudentFacts>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({
      id: profiles.userId,
      name: profiles.displayName,
      school: profiles.school,
      ideaStatus: profiles.ideaStatus,
      ideaSummary: profiles.ideaSummary,
      weeklyHours: profiles.weeklyHours,
      summerPlans: profiles.summerPlans,
    })
    .from(profiles)
    .where(inArray(profiles.userId, ids));
  return new Map(rows.map(({ id, ...f }) => [id, f]));
}

type ReasonInputs = Pick<CompatibilityResult, "complementarySkills" | "sharedInterests" | "explanation">;

/** "Why you two" for one pair, phrased for the viewer. */
export async function whyYouTwo(viewerId: string, otherId: string, result: ReasonInputs): Promise<string[]> {
  const facts = await loadStudentFacts([viewerId, otherId]);
  const v = facts.get(viewerId);
  const o = facts.get(otherId);
  if (!v || !o) return [result.explanation];
  return studentReasons(v, o, result as CompatibilityResult);
}
