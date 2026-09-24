import { and, asc, desc, eq, gt, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { interests, matches, profiles, recommendations, userRoles } from "../db/schema";
import { activeScorer } from "../matching";
import { loadMatchProfiles } from "../matching/profiles";
import { getMatchWeights } from "../matching/weights";
import type { CompatibilityResult, MatchProfile } from "../matching/types";
import { discoverableProfile, getBlockedIds } from "../privacy/visibility";
import { getSetting } from "../settings";
import { COFOUNDER_TYPE_LABELS, SKILL_CATEGORY_LABELS, type SkillCategory } from "@/lib/domain";
import { COFOUNDER_TYPE_SKILL_CATEGORIES } from "@/lib/domain";
import { explanationWriter } from "./explanations";

/** Max candidates scored per generation. Candidates are pre-filtered and ordered in SQL. */
const CANDIDATE_POOL = 300;

export function localDateFor(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** A short, specific reason this person was surfaced today, from structured data only. */
export function recommendationReason(viewer: MatchProfile, candidate: MatchProfile, result: CompatibilityResult): string {
  const first = candidate.name.split(" ")[0] ?? candidate.name;
  const soughtCats = new Set(viewer.cofounderTypesSought.flatMap((t) => COFOUNDER_TYPE_SKILL_CATEGORIES[t]));
  const bringing = [...new Set(candidate.skills.map((s) => s.category))].filter((c) => soughtCats.has(c));
  if (bringing.length) {
    return `${first} brings ${bringing.map((c) => SKILL_CATEGORY_LABELS[c as SkillCategory]).join(" and ")} — what you said your team is missing.`;
  }
  const theySeek = candidate.cofounderTypesSought.find((t) =>
    COFOUNDER_TYPE_SKILL_CATEGORIES[t].some((c) => viewer.skills.some((s) => s.category === c)),
  );
  if (theySeek) return `${first} is looking for a ${COFOUNDER_TYPE_LABELS[theySeek].toLowerCase()} cofounder — that's you.`;
  if (result.sharedInterests.length) return `You're both building in ${result.sharedInterests.slice(0, 2).join(" and ")}.`;
  const top = result.strengths[0];
  return top ? top.detail : `${first} is actively looking for a cofounder.`;
}

/** Profile completeness in [0,1] used as a light ranking signal (never shown as a score). */
function completeness(p: MatchProfile) {
  let s = 0;
  if (p.skills.length) s += 0.3;
  if (p.industries.length) s += 0.15;
  if (p.personality) s += 0.25;
  if (p.commitment) s += 0.1;
  if (p.ambition) s += 0.1;
  if (p.availability) s += 0.1;
  return s;
}

async function candidateIds(viewerId: string, cooldownDays: number) {
  const blocked = [...(await getBlockedIds(viewerId))];
  const since = new Date(Date.now() - cooldownDays * 86_400_000);
  // Exclude: people I already acted on (interested ever, passed within cooldown), existing matches, blocks.
  const acted = db
    .select({ id: interests.toUserId })
    .from(interests)
    .where(and(eq(interests.fromUserId, viewerId), or(eq(interests.kind, "interested"), gt(interests.updatedAt, since))));
  const matchedA = db.select({ id: matches.userBId }).from(matches).where(eq(matches.userAId, viewerId));
  const matchedB = db.select({ id: matches.userAId }).from(matches).where(eq(matches.userBId, viewerId));
  const seekingRoles = db
    .select({ id: userRoles.userId })
    .from(userRoles)
    .where(inArray(userRoles.role, ["founder", "cofounder_candidate"]));

  const rows = await db
    .select({ id: profiles.userId })
    .from(profiles)
    .where(
      and(
        discoverableProfile(),
        ne(profiles.userId, viewerId),
        or(eq(profiles.lookingForCofounder, true), inArray(profiles.userId, seekingRoles)),
        notInArray(profiles.userId, acted),
        notInArray(profiles.userId, matchedA),
        notInArray(profiles.userId, matchedB),
        blocked.length ? notInArray(profiles.userId, blocked) : undefined,
      ),
    )
    // Activity-first so dormant accounts don't crowd out people who will reply.
    .orderBy(desc(profiles.lastActiveAt))
    .limit(CANDIDATE_POOL);
  return rows.map((r) => r.id);
}

/**
 * Today's curated cofounder recommendations (up to the configured daily limit, default 5).
 * Generated once per user per local day and stored, so the set is stable all day.
 */
export async function getDailyRecommendations(viewerId: string, opts: { now?: Date } = {}) {
  const [viewerProfile] = await db.select().from(profiles).where(eq(profiles.userId, viewerId)).limit(1);
  if (!viewerProfile) return { forDate: localDateFor("UTC"), items: [] as DailyRecommendation[] };
  const forDate = localDateFor(viewerProfile.timezone, opts.now);

  const existing = await db
    .select()
    .from(recommendations)
    .where(and(eq(recommendations.userId, viewerId), eq(recommendations.forDate, forDate), eq(recommendations.kind, "cofounder")))
    .orderBy(asc(recommendations.rank));
  if (existing.length) return { forDate, items: await hydrate(existing, viewerId) };

  const limit = await getSetting("daily_recommendation_limit");
  const cooldown = await getSetting("pass_cooldown_days");
  const ids = await candidateIds(viewerId, cooldown);
  if (!ids.length) return { forDate, items: [] };

  // Avoid showing the same people as yesterday unless the pool is tiny.
  const recent = await db
    .select({ id: recommendations.candidateId })
    .from(recommendations)
    .where(and(eq(recommendations.userId, viewerId), gt(recommendations.createdAt, new Date(Date.now() - 3 * 86_400_000))));
  const recentSet = new Set(recent.map((r) => r.id));

  const profilesMap = await loadMatchProfiles([viewerId, ...ids]);
  const viewer = profilesMap.get(viewerId);
  if (!viewer) return { forDate, items: [] };
  const weights = await getMatchWeights();
  const activity = new Map(
    (await db.select({ id: profiles.userId, at: profiles.lastActiveAt }).from(profiles).where(inArray(profiles.userId, ids))).map((r) => [r.id, r.at]),
  );

  const scored = ids
    .map((id) => profilesMap.get(id))
    .filter((c): c is MatchProfile => !!c)
    .map((c) => {
      const result = activeScorer.score(viewer, c, weights);
      const daysIdle = (Date.now() - (activity.get(c.userId)?.getTime() ?? 0)) / 86_400_000;
      const activityBoost = daysIdle < 3 ? 1 : daysIdle < 14 ? 0.97 : daysIdle < 45 ? 0.9 : 0.8;
      const repeatPenalty = recentSet.has(c.userId) ? 0.85 : 1;
      const rankScore = result.score * activityBoost * repeatPenalty * (0.9 + 0.1 * completeness(c));
      return { candidate: c, result, rankScore };
    })
    .sort((x, y) => y.rankScore - x.rankScore)
    .slice(0, limit);

  const explanations = await explanationWriter.write(viewer, scored.map((s) => ({ candidate: s.candidate, result: s.result })));

  const rows = scored.map((s, i) => ({
    userId: viewerId,
    candidateId: s.candidate.userId,
    forDate,
    kind: "cofounder",
    rank: i + 1,
    score: s.result.score,
    rankScore: s.rankScore,
    factors: s.result.factors,
    frictions: s.result.frictions,
    explanation: explanations[i] ?? s.result.explanation,
    reason: recommendationReason(viewer, s.candidate, s.result),
  }));
  if (rows.length) await db.insert(recommendations).values(rows).onConflictDoNothing();

  const stored = await db
    .select()
    .from(recommendations)
    .where(and(eq(recommendations.userId, viewerId), eq(recommendations.forDate, forDate), eq(recommendations.kind, "cofounder")))
    .orderBy(asc(recommendations.rank));
  return { forDate, items: await hydrate(stored, viewerId) };
}

export type DailyRecommendation = Awaited<ReturnType<typeof hydrate>>[number];

/** Complementary skills / shared industries, derived from structured data (never generated text). */
export function overlapDetails(viewer: MatchProfile, candidate: MatchProfile) {
  const sought = new Set(viewer.cofounderTypesSought.flatMap((t) => COFOUNDER_TYPE_SKILL_CATEGORIES[t]));
  const viewerCats = new Set(viewer.skills.map((s) => s.category));
  const complementarySkills = candidate.skills
    .filter((s) => (sought.size ? sought.has(s.category) : !viewerCats.has(s.category)))
    .map((s) => s.name);
  const viewerIndustries = new Set(viewer.industries.map((i) => i.slug));
  const sharedInterests = candidate.industries.filter((i) => viewerIndustries.has(i.slug)).map((i) => i.name);
  return { complementarySkills, sharedInterests };
}

async function hydrate(rows: (typeof recommendations.$inferSelect)[], viewerId: string) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.candidateId);
  const profileRows = await db
    .select()
    .from(profiles)
    .where(and(inArray(profiles.userId, ids), eq(profiles.status, "active"), isNull(profiles.deletedAt)));
  const matchProfiles = await loadMatchProfiles([viewerId, ...ids]);
  const viewer = matchProfiles.get(viewerId);
  return rows
    .map((r) => {
      const p = profileRows.find((x) => x.userId === r.candidateId);
      const mp = matchProfiles.get(r.candidateId);
      if (!p || !mp || !viewer) return null;
      const overlap = overlapDetails(viewer, mp);
      const strengths = r.factors.filter((f) => f.known && f.score >= 0.75).sort((a, b) => b.score * b.weight - a.score * a.weight);
      return {
        id: r.id,
        rank: r.rank,
        score: r.score,
        action: r.action,
        explanation: r.explanation,
        reason: r.reason,
        factors: r.factors,
        strengths,
        frictions: r.frictions,
        person: {
          userId: p.userId,
          handle: p.handle,
          name: p.displayName,
          avatarUrl: p.avatarUrl,
          headline: p.headline,
          currentRole: p.currentRole,
          currentCompany: p.currentCompany,
          location: p.location ?? ([p.city, p.country].filter(Boolean).join(", ") || null),
          university: p.university,
          bio: p.bio,
          availability: p.availability,
          commitment: p.commitment,
          stagePreferences: p.stagePreferences,
          isDemo: p.isDemo,
          skills: mp.skills.map((s) => s.name),
          industries: mp.industries.map((i) => i.name),
          complementarySkills: overlap.complementarySkills,
          sharedInterests: overlap.sharedInterests,
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

export async function markRecommendationViewed(viewerId: string, recommendationId: string) {
  await db
    .update(recommendations)
    .set({ viewedAt: new Date() })
    .where(and(eq(recommendations.id, recommendationId), eq(recommendations.userId, viewerId), isNull(recommendations.viewedAt)));
}

export async function setRecommendationAction(viewerId: string, candidateId: string, action: "passed" | "saved" | "interested") {
  await db
    .update(recommendations)
    .set({ action, actedAt: new Date() })
    .where(and(eq(recommendations.userId, viewerId), eq(recommendations.candidateId, candidateId), sql`${recommendations.forDate} >= current_date - 1`));
}
