import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { blocks, connections, conversationMembers, matches, profiles, startupMembers } from "../db/schema";

/** Users hidden from the viewer in both directions because of a block. */
export async function getBlockedIds(viewerId: string, conn: DbOrTx = db): Promise<Set<string>> {
  const rows = await conn
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, viewerId)));
  return new Set(rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId)));
}

export async function isBlockedEitherWay(a: string, b: string, conn: DbOrTx = db): Promise<boolean> {
  const [row] = await conn
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))))
    .limit(1);
  return !!row;
}

/** SQL condition: profile is an active, discoverable account (used by search, recommendations, AI tools). */
export function discoverableProfile(): SQL {
  return and(
    eq(profiles.status, "active"),
    isNull(profiles.deletedAt),
    eq(profiles.visibility, "public"),
    sql`${profiles.onboardingCompletedAt} is not null`,
  )!;
}

/** Whether two users have a relationship that grants "members"-level visibility. */
export async function haveRelationship(a: string, b: string, conn: DbOrTx = db): Promise<boolean> {
  const [x, y] = a < b ? [a, b] : [b, a];
  const [match] = await conn
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.userAId, x), eq(matches.userBId, y), isNull(matches.unmatchedAt)))
    .limit(1);
  if (match) return true;
  const [connection] = await conn
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(
        eq(connections.status, "accepted"),
        or(and(eq(connections.requesterId, a), eq(connections.addresseeId, b)), and(eq(connections.requesterId, b), eq(connections.addresseeId, a))),
      ),
    )
    .limit(1);
  if (connection) return true;
  const shared = await conn.execute(sql`
    select 1 from ${startupMembers} m1 join ${startupMembers} m2 on m1.startup_id = m2.startup_id
    where m1.user_id = ${a} and m2.user_id = ${b} and m1.removed_at is null and m2.removed_at is null limit 1`);
  if (shared.length) return true;
  const convo = await conn.execute(sql`
    select 1 from ${conversationMembers} c1 join ${conversationMembers} c2 on c1.conversation_id = c2.conversation_id
    where c1.user_id = ${a} and c2.user_id = ${b} limit 1`);
  return convo.length > 0;
}

/** Can `viewerId` see the full profile of `targetId`? Server-side check used by every profile read. */
export async function canViewProfile(viewerId: string | null, targetId: string, conn: DbOrTx = db): Promise<boolean> {
  if (viewerId === targetId) return true;
  const [p] = await conn
    .select({ status: profiles.status, visibility: profiles.visibility, deletedAt: profiles.deletedAt })
    .from(profiles)
    .where(eq(profiles.userId, targetId))
    .limit(1);
  if (!p || p.status !== "active" || p.deletedAt) return false;
  if (!viewerId) return false;
  if (await isBlockedEitherWay(viewerId, targetId, conn)) return false;
  if (p.visibility === "public") return true;
  return haveRelationship(viewerId, targetId, conn);
}

export async function filterVisibleIds(viewerId: string, ids: string[], conn: DbOrTx = db): Promise<string[]> {
  if (!ids.length) return [];
  const blocked = await getBlockedIds(viewerId, conn);
  const rows = await conn
    .select({ id: profiles.userId })
    .from(profiles)
    .where(and(inArray(profiles.userId, ids), discoverableProfile()));
  const ok = new Set(rows.map((r) => r.id));
  return ids.filter((id) => ok.has(id) && !blocked.has(id));
}
