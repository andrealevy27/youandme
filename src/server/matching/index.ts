import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { compatibilityResults } from "../db/schema";
import { rulesScorer } from "./engine";
import { loadMatchProfiles } from "./profiles";
import type { CompatibilityResult, CompatibilityScorer } from "./types";
import { getMatchWeights } from "./weights";

/** The active scorer. Replace with an ML-backed implementation of `CompatibilityScorer`. */
export const activeScorer: CompatibilityScorer = rulesScorer;

/** Compatibility from the viewer's perspective (explanations are phrased for the viewer). */
export async function getCompatibility(viewerId: string, otherId: string): Promise<CompatibilityResult | null> {
  if (viewerId === otherId) return null;
  const profilesMap = await loadMatchProfiles([viewerId, otherId]);
  const a = profilesMap.get(viewerId);
  const b = profilesMap.get(otherId);
  if (!a || !b) return null;
  const result = activeScorer.score(a, b, await getMatchWeights());
  await cacheCompatibility(viewerId, otherId, result);
  return result;
}

async function cacheCompatibility(x: string, y: string, r: CompatibilityResult) {
  const [userAId, userBId] = x < y ? [x, y] : [y, x];
  await db
    .insert(compatibilityResults)
    .values({
      userAId,
      userBId,
      score: r.score,
      factors: r.factors,
      frictions: r.frictions,
      explanation: r.explanation,
      algorithmVersion: r.algorithmVersion,
    })
    .onConflictDoUpdate({
      target: [compatibilityResults.userAId, compatibilityResults.userBId, compatibilityResults.algorithmVersion],
      set: { score: r.score, factors: r.factors, frictions: r.frictions, explanation: r.explanation, computedAt: new Date() },
    });
}

export async function getCachedCompatibility(x: string, y: string) {
  const [userAId, userBId] = x < y ? [x, y] : [y, x];
  const [row] = await db
    .select()
    .from(compatibilityResults)
    .where(
      and(
        eq(compatibilityResults.userAId, userAId),
        eq(compatibilityResults.userBId, userBId),
        eq(compatibilityResults.algorithmVersion, activeScorer.version),
      ),
    )
    .limit(1);
  return row ?? null;
}

export { loadMatchProfiles, loadMatchProfile } from "./profiles";
export { scoreCompatibility } from "./engine";
export type * from "./types";
