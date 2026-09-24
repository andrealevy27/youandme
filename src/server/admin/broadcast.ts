import "server-only";
import { and, asc, eq, gt, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, notifications, profiles, userRoles } from "../db/schema";
import { audit } from "../audit";
import type { Viewer } from "../auth/session";

export const BROADCAST_BATCH = 500;

export type BroadcastInput = {
  title: string;
  body?: string;
  href?: string;
  audience: "all" | { role: string };
  excludeDemo: boolean;
};

function audienceFilter(input: BroadcastInput): SQL | undefined {
  return and(
    eq(profiles.status, "active"),
    isNull(profiles.deletedAt),
    input.excludeDemo ? eq(profiles.isDemo, false) : undefined,
    input.audience === "all"
      ? undefined
      : sql`exists (select 1 from ${userRoles} where ${userRoles.userId} = ${profiles.userId} and ${userRoles.role} = ${input.audience.role})`,
  );
}

/**
 * In-app 'system' notification to every active member (or one role).
 * Recipients are paged by keyset on user id and inserted 500 at a time,
 * so memory stays flat no matter how large the network grows.
 */
export async function broadcastNotification(actor: Viewer, input: BroadcastInput) {
  const filter = audienceFilter(input);
  let cursor: string | null = null;
  let sent = 0;
  for (;;) {
    const batch: { userId: string }[] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(and(filter, cursor ? gt(profiles.userId, cursor) : undefined))
      .orderBy(asc(profiles.userId))
      .limit(BROADCAST_BATCH);
    if (!batch.length) break;
    await db.insert(notifications).values(
      batch.map((r) => ({
        userId: r.userId,
        type: "system",
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        actorId: actor.userId,
        data: { broadcast: true },
      })),
    );
    sent += batch.length;
    cursor = batch[batch.length - 1]!.userId;
    if (batch.length < BROADCAST_BATCH) break;
  }
  await audit({
    actorId: actor.userId,
    action: "notifications.broadcast",
    targetType: "notification",
    metadata: {
      title: input.title,
      audience: input.audience === "all" ? "all" : `role:${input.audience.role}`,
      excludeDemo: input.excludeDemo,
      sent,
    },
  });
  return { sent };
}

export async function recentBroadcasts(limit = 10) {
  return db
    .select({ id: auditLogs.id, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorName: profiles.displayName })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.userId, auditLogs.actorId))
    .where(eq(auditLogs.action, "notifications.broadcast"))
    .orderBy(sql`${auditLogs.createdAt} desc`)
    .limit(limit);
}

/** Recipients per audience, with and without demo accounts, for the send preview. */
export async function broadcastAudienceCounts() {
  const active = and(eq(profiles.status, "active"), isNull(profiles.deletedAt));
  const [all, byRole] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int`, real: sql<number>`(count(*) filter (where not ${profiles.isDemo}))::int` })
      .from(profiles)
      .where(active),
    db
      .select({ role: userRoles.role, total: sql<number>`count(*)::int`, real: sql<number>`(count(*) filter (where not ${profiles.isDemo}))::int` })
      .from(userRoles)
      .innerJoin(profiles, eq(profiles.userId, userRoles.userId))
      .where(active)
      .groupBy(userRoles.role),
  ]);
  const out: Record<string, { total: number; real: number }> = { all: all[0] ?? { total: 0, real: 0 } };
  for (const r of byRole) out[r.role] = { total: r.total, real: r.real };
  return out;
}
