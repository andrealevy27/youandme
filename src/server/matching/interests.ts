import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { interests, matches, profiles, savedItems } from "../db/schema";
import { AppError, forbidden } from "../errors";
import { addSystemMessage, createConversation } from "../messaging";
import { notify } from "../notifications";
import { canViewProfile } from "../privacy/visibility";
import { enforceRateLimit } from "../rate-limit";
import { setRecommendationAction } from "../recommendations";
import { track } from "../analytics";
import { getPersonSummaries } from "../people";
import { getCompatibility } from ".";

const ordered = (a: string, b: string) => (a < b ? ([a, b] as const) : ([b, a] as const));

async function upsertInterest(fromUserId: string, toUserId: string, kind: "interested" | "passed", note?: string | null) {
  await db
    .insert(interests)
    .values({ fromUserId, toUserId, kind, note: note ?? null })
    .onConflictDoUpdate({ target: [interests.fromUserId, interests.toUserId], set: { kind, note: note ?? null, updatedAt: new Date() } });
}

/**
 * "Interested" in someone as a potential cofounder. When interest is mutual a Match
 * is created with its own conversation and both people are notified.
 */
export async function expressInterest(viewerId: string, targetId: string, note?: string) {
  if (viewerId === targetId) throw new AppError("VALIDATION", "That's you!");
  enforceRateLimit("interest", viewerId);
  if (!(await canViewProfile(viewerId, targetId))) throw forbidden("This profile isn't available.");
  await upsertInterest(viewerId, targetId, "interested", note?.slice(0, 300));
  await setRecommendationAction(viewerId, targetId, "interested");
  track("profile_liked", viewerId);

  const [reciprocal] = await db
    .select()
    .from(interests)
    .where(and(eq(interests.fromUserId, targetId), eq(interests.toUserId, viewerId), eq(interests.kind, "interested")))
    .limit(1);
  if (!reciprocal) return { matched: false as const };

  const [a, b] = ordered(viewerId, targetId);
  const [existing] = await db.select().from(matches).where(and(eq(matches.userAId, a), eq(matches.userBId, b))).limit(1);
  if (existing && !existing.unmatchedAt) return { matched: true as const, matchId: existing.id, conversationId: existing.conversationId };

  const compat = await getCompatibility(viewerId, targetId);
  const result = await db.transaction(async (tx) => {
    const [match] = existing
      ? await tx.update(matches).set({ unmatchedAt: null, score: compat?.score ?? null, createdAt: new Date() }).where(eq(matches.id, existing.id)).returning()
      : await tx.insert(matches).values({ userAId: a, userBId: b, score: compat?.score ?? null }).returning();
    let conversationId = match!.conversationId;
    if (!conversationId) {
      const convo = await createConversation({ type: "match", memberIds: [a, b], createdById: viewerId, matchId: match!.id }, tx);
      conversationId = convo.id;
      await tx.update(matches).set({ conversationId }).where(eq(matches.id, match!.id));
      await addSystemMessage(conversationId, "You matched on You&Me. Say hello — a good first message mentions what you're building.", tx);
    }
    return { matchId: match!.id, conversationId };
  });

  const names = await db
    .select({ id: profiles.userId, name: profiles.displayName })
    .from(profiles)
    .where(or(eq(profiles.userId, viewerId), eq(profiles.userId, targetId)));
  const nameOf = (id: string) => names.find((n) => n.id === id)?.name ?? "Someone";
  for (const [to, other] of [
    [viewerId, targetId],
    [targetId, viewerId],
  ] as const) {
    await notify({
      userId: to,
      type: "new_match",
      title: `You matched with ${nameOf(other)}`,
      body: "You're both interested in building together. Start the conversation.",
      href: `/messages/${result.conversationId}`,
      actorId: other,
    });
  }
  track("match_created", viewerId, { score: compat?.score ?? null });
  return { matched: true as const, ...result };
}

export async function passOn(viewerId: string, targetId: string) {
  if (viewerId === targetId) return;
  enforceRateLimit("interest", viewerId);
  await upsertInterest(viewerId, targetId, "passed");
  await setRecommendationAction(viewerId, targetId, "passed");
  track("recommendation_passed", viewerId);
}

export async function saveFromRecommendation(viewerId: string, targetId: string) {
  await db.insert(savedItems).values({ userId: viewerId, targetType: "user", targetId }).onConflictDoNothing();
  await setRecommendationAction(viewerId, targetId, "saved");
  track("recommendation_saved", viewerId);
}

export async function unmatch(viewerId: string, matchId: string) {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m || (m.userAId !== viewerId && m.userBId !== viewerId)) throw forbidden();
  await db.update(matches).set({ unmatchedAt: new Date() }).where(eq(matches.id, matchId));
  const other = m.userAId === viewerId ? m.userBId : m.userAId;
  await upsertInterest(viewerId, other, "passed");
}

/** Active mutual matches, newest first. */
export async function listMatches(viewerId: string) {
  const rows = await db
    .select()
    .from(matches)
    .where(and(or(eq(matches.userAId, viewerId), eq(matches.userBId, viewerId)), isNull(matches.unmatchedAt)))
    .orderBy(desc(matches.createdAt))
    .limit(100);
  const otherIds = rows.map((m) => (m.userAId === viewerId ? m.userBId : m.userAId));
  const people = await getPersonSummaries(otherIds);
  return rows
    .map((m) => {
      const otherId = m.userAId === viewerId ? m.userBId : m.userAId;
      const person = people.find((p) => p.userId === otherId);
      return person ? { id: m.id, score: m.score, conversationId: m.conversationId, createdAt: m.createdAt, person } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

/** People the viewer has said they're interested in who haven't responded yet. */
export async function listPendingInterests(viewerId: string) {
  const rows = await db
    .select({ toUserId: interests.toUserId, at: interests.updatedAt })
    .from(interests)
    .where(
      and(
        eq(interests.fromUserId, viewerId),
        eq(interests.kind, "interested"),
        sql`not exists (select 1 from ${matches} m where ((m.user_a_id = ${viewerId} and m.user_b_id = ${interests.toUserId}) or (m.user_b_id = ${viewerId} and m.user_a_id = ${interests.toUserId})) and m.unmatched_at is null)`,
      ),
    )
    .orderBy(desc(interests.updatedAt))
    .limit(50);
  const people = await getPersonSummaries(rows.map((r) => r.toUserId));
  return rows.map((r) => ({ at: r.at, person: people.find((p) => p.userId === r.toUserId) })).filter((r) => r.person);
}

export async function getRelationship(viewerId: string, targetId: string) {
  const [mine] = await db.select().from(interests).where(and(eq(interests.fromUserId, viewerId), eq(interests.toUserId, targetId))).limit(1);
  const [a, b] = ordered(viewerId, targetId);
  const [match] = await db.select().from(matches).where(and(eq(matches.userAId, a), eq(matches.userBId, b), isNull(matches.unmatchedAt))).limit(1);
  return { myInterest: mine?.kind ?? null, match: match ?? null };
}
