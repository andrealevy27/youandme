import "server-only";
import { and, count, desc, eq, ilike, isNotNull, isNull, ne, or, type SQL } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, profiles, startups } from "../db/schema";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import type { Viewer } from "../auth/session";
import { VISIBILITY, type Visibility } from "@/lib/domain";
import { ADMIN_PAGE_SIZE, likePattern, pageOffset } from "./utils";

export const STARTUP_FILTERS = ["live", "hidden", "deleted", "all"] as const;
export type StartupFilter = (typeof STARTUP_FILTERS)[number];

export async function listStartups(opts: { filter: StartupFilter; q?: string; page: number }) {
  const filters: (SQL | undefined)[] = [];
  if (opts.filter === "live") filters.push(isNull(startups.deletedAt), ne(startups.visibility, "hidden"));
  if (opts.filter === "hidden") filters.push(isNull(startups.deletedAt), eq(startups.visibility, "hidden"));
  if (opts.filter === "deleted") filters.push(isNotNull(startups.deletedAt));
  if (opts.q) {
    const p = likePattern(opts.q);
    filters.push(or(ilike(startups.name, p), ilike(startups.slug, p), ilike(startups.tagline, p)));
  }
  const where = and(...filters);
  const [rows, total] = await Promise.all([
    db
      .select({
        id: startups.id,
        name: startups.name,
        slug: startups.slug,
        tagline: startups.tagline,
        stage: startups.stage,
        status: startups.status,
        visibility: startups.visibility,
        isDemo: startups.isDemo,
        deletedAt: startups.deletedAt,
        createdAt: startups.createdAt,
        creatorName: profiles.displayName,
        creatorId: startups.createdById,
      })
      .from(startups)
      .leftJoin(profiles, eq(profiles.userId, startups.createdById))
      .where(where)
      .orderBy(desc(startups.createdAt), desc(startups.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(opts.page)),
    db.select({ n: count() }).from(startups).where(where),
  ]);
  return { rows, total: total[0]?.n ?? 0 };
}

async function load(id: string) {
  const [row] = await db.select().from(startups).where(eq(startups.id, id)).limit(1);
  if (!row) throw notFound("That startup");
  return row;
}

export async function hideStartup(actor: Viewer, input: { id: string; reason?: string }) {
  const s = await load(input.id);
  if (s.visibility === "hidden") throw new AppError("CONFLICT", "This startup is already hidden.");
  await db.update(startups).set({ visibility: "hidden" }).where(eq(startups.id, input.id));
  await audit({
    actorId: actor.userId,
    action: "startup.hidden",
    targetType: "startup",
    targetId: input.id,
    metadata: { previousVisibility: s.visibility, reason: input.reason ?? null },
  });
}

/** The visibility a startup had before an admin hid it (from the audit trail), else public. */
async function previousVisibility(id: string): Promise<Visibility> {
  const [row] = await db
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(and(eq(auditLogs.targetType, "startup"), eq(auditLogs.targetId, id), eq(auditLogs.action, "startup.hidden")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  const prev = row?.metadata?.previousVisibility;
  return typeof prev === "string" && (VISIBILITY as readonly string[]).includes(prev) && prev !== "hidden" ? (prev as Visibility) : "public";
}

export async function restoreStartup(actor: Viewer, input: { id: string }) {
  const s = await load(input.id);
  if (s.visibility !== "hidden" && !s.deletedAt) throw new AppError("CONFLICT", "This startup is already live.");
  const visibility = s.visibility === "hidden" ? await previousVisibility(input.id) : s.visibility;
  await db.update(startups).set({ visibility, deletedAt: null }).where(eq(startups.id, input.id));
  await audit({
    actorId: actor.userId,
    action: "startup.restored",
    targetType: "startup",
    targetId: input.id,
    metadata: { visibility, wasDeleted: !!s.deletedAt },
  });
}

export async function softDeleteStartup(actor: Viewer, input: { id: string; reason: string }) {
  const s = await load(input.id);
  if (s.deletedAt) throw new AppError("CONFLICT", "This startup is already deleted.");
  await db.update(startups).set({ deletedAt: new Date() }).where(eq(startups.id, input.id));
  await audit({ actorId: actor.userId, action: "startup.deleted", targetType: "startup", targetId: input.id, metadata: { reason: input.reason, name: s.name } });
}
