import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { consultantProfiles, profiles, savedCollections, savedItems, startupMembers, startups } from "../db/schema";
import { AppError, forbidden, notFound } from "../errors";
import { canViewProfile, getBlockedIds } from "../privacy/visibility";
import { SAVE_TARGETS, type SaveTarget } from "@/lib/domain";

/**
 * Saved items and collections. Every user has one default "Saved" collection (created lazily);
 * legacy rows with a null collection are treated as belonging to it.
 * Target ids: `user` / `consultant` → user id, `startup` → startup id.
 */

export const saveTargetSchema = z.enum(SAVE_TARGETS);
const collectionName = z.string().trim().min(1, "Give the collection a name.").max(60, "Keep it under 60 characters.");

export async function ensureDefaultCollection(userId: string) {
  const [existing] = await db
    .select()
    .from(savedCollections)
    .where(and(eq(savedCollections.userId, userId), eq(savedCollections.isDefault, true)))
    .orderBy(asc(savedCollections.createdAt))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(savedCollections).values({ userId, name: "Saved", isDefault: true }).returning();
  return created!;
}

async function assertOwnCollection(userId: string, collectionId: string) {
  const [c] = await db.select().from(savedCollections).where(eq(savedCollections.id, collectionId)).limit(1);
  if (!c || c.userId !== userId) throw notFound("That collection");
  return c;
}

/** Only allow saving things the viewer can actually see. */
async function assertSavable(userId: string, targetType: SaveTarget, targetId: string) {
  if (targetType === "user") {
    if (targetId === userId) throw new AppError("VALIDATION", "You can't save yourself.");
    if (!(await canViewProfile(userId, targetId))) throw notFound("That person");
    return;
  }
  if (targetType === "consultant") {
    const [c] = await db.select({ status: consultantProfiles.status }).from(consultantProfiles).where(eq(consultantProfiles.userId, targetId)).limit(1);
    if (!c || c.status !== "approved" || !(await canViewProfile(userId, targetId))) throw notFound("That consultant");
    return;
  }
  const [s] = await db.select({ visibility: startups.visibility, deletedAt: startups.deletedAt }).from(startups).where(eq(startups.id, targetId)).limit(1);
  if (!s || s.deletedAt) throw notFound("That startup");
  if (s.visibility === "hidden") {
    const [m] = await db
      .select({ id: startupMembers.id })
      .from(startupMembers)
      .where(and(eq(startupMembers.startupId, targetId), eq(startupMembers.userId, userId), isNull(startupMembers.removedAt)))
      .limit(1);
    if (!m) throw notFound("That startup");
  }
}

export async function isSaved(userId: string, targetType: SaveTarget, targetId: string) {
  const [row] = await db
    .select({ id: savedItems.id })
    .from(savedItems)
    .where(and(eq(savedItems.userId, userId), eq(savedItems.targetType, targetType), eq(savedItems.targetId, targetId)))
    .limit(1);
  return !!row;
}

/** Batch variant for lists of cards. */
export async function savedTargetIds(userId: string, targetType: SaveTarget, targetIds: string[]) {
  if (!targetIds.length) return new Set<string>();
  const rows = await db
    .select({ targetId: savedItems.targetId })
    .from(savedItems)
    .where(and(eq(savedItems.userId, userId), eq(savedItems.targetType, targetType), inArray(savedItems.targetId, targetIds)));
  return new Set(rows.map((r) => r.targetId));
}

/** Save if not saved (into `collectionId` or the default collection), otherwise unsave. */
export async function toggleSaved(userId: string, targetType: SaveTarget, targetId: string, collectionId?: string) {
  saveTargetSchema.parse(targetType);
  const where = and(eq(savedItems.userId, userId), eq(savedItems.targetType, targetType), eq(savedItems.targetId, targetId));
  const [existing] = await db.select({ id: savedItems.id }).from(savedItems).where(where).limit(1);
  if (existing) {
    await db.delete(savedItems).where(eq(savedItems.id, existing.id));
    return { saved: false as const };
  }
  await assertSavable(userId, targetType, targetId);
  const collection = collectionId ? await assertOwnCollection(userId, collectionId) : await ensureDefaultCollection(userId);
  await db.insert(savedItems).values({ userId, targetType, targetId, collectionId: collection.id }).onConflictDoNothing();
  return { saved: true as const, collectionId: collection.id };
}

export async function removeSavedItem(userId: string, itemId: string) {
  await db.delete(savedItems).where(and(eq(savedItems.id, itemId), eq(savedItems.userId, userId)));
}

export async function moveSavedItem(userId: string, itemId: string, collectionId: string) {
  await assertOwnCollection(userId, collectionId);
  const res = await db
    .update(savedItems)
    .set({ collectionId })
    .where(and(eq(savedItems.id, itemId), eq(savedItems.userId, userId)))
    .returning({ id: savedItems.id });
  if (!res.length) throw notFound("That saved item");
}

export async function listCollections(userId: string) {
  const def = await ensureDefaultCollection(userId);
  const [rows, counts] = await Promise.all([
    db
      .select({ id: savedCollections.id, name: savedCollections.name, createdAt: savedCollections.createdAt })
      .from(savedCollections)
      .where(eq(savedCollections.userId, userId))
      .orderBy(desc(savedCollections.isDefault), asc(savedCollections.createdAt)),
    db
      .select({ collectionId: savedItems.collectionId, n: sql<number>`count(*)::int` })
      .from(savedItems)
      .where(eq(savedItems.userId, userId))
      .groupBy(savedItems.collectionId),
  ]);
  const countFor = (id: string) =>
    counts.filter((c) => c.collectionId === id || (id === def.id && c.collectionId === null)).reduce((s, c) => s + c.n, 0);
  return rows.map((r) => ({ ...r, isDefault: r.id === def.id, count: countFor(r.id) }));
}

export async function createCollection(userId: string, rawName: string) {
  const name = collectionName.parse(rawName);
  const count = await db.select({ n: sql<number>`count(*)::int` }).from(savedCollections).where(eq(savedCollections.userId, userId));
  if ((count[0]?.n ?? 0) >= 50) throw new AppError("VALIDATION", "You've reached the limit of 50 collections.");
  const [row] = await db.insert(savedCollections).values({ userId, name, isDefault: false }).returning();
  return row!;
}

export async function renameCollection(userId: string, collectionId: string, rawName: string) {
  const name = collectionName.parse(rawName);
  await assertOwnCollection(userId, collectionId);
  await db.update(savedCollections).set({ name }).where(eq(savedCollections.id, collectionId));
}

/** Deleting a collection keeps its items — they move back to the default collection. */
export async function deleteCollection(userId: string, collectionId: string) {
  const c = await assertOwnCollection(userId, collectionId);
  const def = await ensureDefaultCollection(userId);
  if (c.isDefault || c.id === def.id) throw forbidden("Your default collection can't be deleted.");
  await db.update(savedItems).set({ collectionId: def.id }).where(and(eq(savedItems.userId, userId), eq(savedItems.collectionId, collectionId)));
  await db.delete(savedCollections).where(eq(savedCollections.id, collectionId));
}

export type SavedCard = {
  itemId: string;
  collectionId: string;
  targetType: SaveTarget;
  targetId: string;
  savedAt: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
  isDemo: boolean;
};

/**
 * Saved items hydrated into cards. Items the viewer can no longer see (blocked, hidden,
 * deleted) are omitted rather than shown with stale data.
 */
export async function listSaved(userId: string, opts: { targetType?: SaveTarget; collectionId?: string } = {}): Promise<SavedCard[]> {
  const def = await ensureDefaultCollection(userId);
  const collectionFilter = opts.collectionId
    ? opts.collectionId === def.id
      ? or(eq(savedItems.collectionId, def.id), isNull(savedItems.collectionId))
      : eq(savedItems.collectionId, opts.collectionId)
    : undefined;
  const items = await db
    .select()
    .from(savedItems)
    .where(and(eq(savedItems.userId, userId), opts.targetType ? eq(savedItems.targetType, opts.targetType) : undefined, collectionFilter))
    .orderBy(desc(savedItems.createdAt))
    .limit(500);
  if (!items.length) return [];

  const personIds = items.filter((i) => i.targetType !== "startup").map((i) => i.targetId);
  const startupIds = items.filter((i) => i.targetType === "startup").map((i) => i.targetId);
  const [people, consultants, startupRows, memberships, blocked] = await Promise.all([
    personIds.length ? db.select().from(profiles).where(inArray(profiles.userId, personIds)) : Promise.resolve([]),
    personIds.length
      ? db
          .select({ userId: consultantProfiles.userId, headline: consultantProfiles.headline, status: consultantProfiles.status })
          .from(consultantProfiles)
          .where(inArray(consultantProfiles.userId, personIds))
      : Promise.resolve([]),
    startupIds.length ? db.select().from(startups).where(inArray(startups.id, startupIds)) : Promise.resolve([]),
    startupIds.length
      ? db
          .select({ startupId: startupMembers.startupId })
          .from(startupMembers)
          .where(and(eq(startupMembers.userId, userId), inArray(startupMembers.startupId, startupIds), isNull(startupMembers.removedAt)))
      : Promise.resolve([]),
    getBlockedIds(userId),
  ]);

  const cards: SavedCard[] = [];
  for (const item of items) {
    const base = {
      itemId: item.id,
      collectionId: item.collectionId ?? def.id,
      targetType: item.targetType,
      targetId: item.targetId,
      savedAt: item.createdAt.toISOString(),
    };
    if (item.targetType === "startup") {
      const s = startupRows.find((r) => r.id === item.targetId);
      if (!s || s.deletedAt) continue;
      if (s.visibility === "hidden" && !memberships.some((m) => m.startupId === s.id)) continue;
      cards.push({ ...base, title: s.name, subtitle: s.tagline, imageUrl: s.logoUrl, href: `/startups/${s.slug}`, isDemo: s.isDemo });
      continue;
    }
    const p = people.find((r) => r.userId === item.targetId);
    if (!p || p.status !== "active" || p.deletedAt || blocked.has(p.userId)) continue;
    if (p.visibility === "hidden") continue;
    if (item.targetType === "consultant") {
      const c = consultants.find((r) => r.userId === p.userId);
      if (!c || c.status !== "approved") continue;
      cards.push({ ...base, title: p.displayName, subtitle: c.headline, imageUrl: p.avatarUrl, href: `/consultants/${p.handle}`, isDemo: p.isDemo });
    } else {
      cards.push({ ...base, title: p.displayName, subtitle: p.headline, imageUrl: p.avatarUrl, href: `/people/${p.handle}`, isDemo: p.isDemo });
    }
  }
  return cards;
}
