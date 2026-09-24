import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "../db";
import { conversationMembers, conversations, profiles, startupMembers, startups } from "../db/schema";
import { forbidden, notFound } from "../errors";
import { addSystemMessage, createConversation } from ".";

/**
 * Startup team chats. One `startup_group` conversation per startup, whose members mirror
 * the startup's active team (`startup_members.removed_at is null`).
 *
 * Callers (startups service): call `ensureStartupGroupConversation` from the "Team chat"
 * button, and `syncStartupGroupMembers` after any team change (member added/removed/left).
 */

/** Serialise concurrent creates for the same startup (there is no unique index on startup_id + type). */
async function lockStartup(tx: Tx, startupId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"startup_group:" + startupId}))`);
}

async function activeMemberIds(startupId: string, conn: Tx | typeof db = db) {
  const rows = await conn
    .select({ userId: startupMembers.userId })
    .from(startupMembers)
    .innerJoin(profiles, eq(profiles.userId, startupMembers.userId))
    .where(and(eq(startupMembers.startupId, startupId), isNull(startupMembers.removedAt), isNull(profiles.deletedAt)));
  return rows.map((r) => r.userId);
}

async function findGroup(startupId: string, conn: Tx | typeof db = db) {
  const [row] = await conn
    .select()
    .from(conversations)
    .where(and(eq(conversations.startupId, startupId), eq(conversations.type, "startup_group")))
    .limit(1);
  return row ?? null;
}

/**
 * Create (or return) the team chat for a startup. The actor must be an active member.
 * Membership is synced on every call, so it is always safe to call.
 */
export async function ensureStartupGroupConversation(startupId: string, actorId: string) {
  const [startup] = await db
    .select({ id: startups.id, name: startups.name, deletedAt: startups.deletedAt })
    .from(startups)
    .where(eq(startups.id, startupId))
    .limit(1);
  if (!startup || startup.deletedAt) throw notFound("Startup");
  const [membership] = await db
    .select({ id: startupMembers.id })
    .from(startupMembers)
    .where(and(eq(startupMembers.startupId, startupId), eq(startupMembers.userId, actorId), isNull(startupMembers.removedAt)))
    .limit(1);
  if (!membership) throw forbidden("Only team members can open the team chat.");

  const convo = await db.transaction(async (tx) => {
    await lockStartup(tx, startupId);
    const existing = await findGroup(startupId, tx);
    if (existing) return existing;
    const memberIds = await activeMemberIds(startupId, tx);
    const created = await createConversation(
      { type: "startup_group", memberIds, createdById: actorId, title: startup.name, startupId },
      tx,
    );
    await addSystemMessage(created.id, `Team chat for ${startup.name} created.`, tx);
    return created;
  });
  await syncStartupGroupMembers(startupId);
  return convo;
}

/**
 * Bring the team chat's membership in line with the startup's active team.
 * No-op when the startup has no team chat yet. Returns who was added/removed.
 */
export async function syncStartupGroupMembers(startupId: string): Promise<{ conversationId: string | null; added: string[]; removed: string[] }> {
  return db.transaction(async (tx) => {
    await lockStartup(tx, startupId);
    const convo = await findGroup(startupId, tx);
    if (!convo) return { conversationId: null, added: [], removed: [] };
    const [startup] = await tx.select({ name: startups.name }).from(startups).where(eq(startups.id, startupId)).limit(1);
    if (startup && convo.title !== startup.name) {
      await tx.update(conversations).set({ title: startup.name }).where(eq(conversations.id, convo.id));
    }

    const desired = await activeMemberIds(startupId, tx);
    const current = await tx
      .select({ userId: conversationMembers.userId, leftAt: conversationMembers.leftAt })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, convo.id));
    const active = new Set(current.filter((c) => !c.leftAt).map((c) => c.userId));
    const added = desired.filter((id) => !active.has(id));
    const removed = [...active].filter((id) => !desired.includes(id));

    if (added.length) {
      await tx
        .insert(conversationMembers)
        .values(added.map((userId) => ({ conversationId: convo.id, userId, role: "member" })))
        .onConflictDoUpdate({
          target: [conversationMembers.conversationId, conversationMembers.userId],
          set: { leftAt: null, joinedAt: new Date() },
        });
    }
    if (removed.length) {
      await tx
        .update(conversationMembers)
        .set({ leftAt: new Date(), typingAt: null })
        .where(and(eq(conversationMembers.conversationId, convo.id), inArray(conversationMembers.userId, removed)));
    }
    const names = added.length || removed.length
      ? await tx
          .select({ userId: profiles.userId, name: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userId, [...added, ...removed]))
      : [];
    const nameOf = (id: string) => names.find((n) => n.userId === id)?.name ?? "A teammate";
    for (const id of added) await addSystemMessage(convo.id, `${nameOf(id)} joined the team chat.`, tx);
    for (const id of removed) await addSystemMessage(convo.id, `${nameOf(id)} left the team chat.`, tx);
    return { conversationId: convo.id, added, removed };
  });
}
