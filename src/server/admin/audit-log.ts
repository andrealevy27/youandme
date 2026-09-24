import "server-only";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, profiles } from "../db/schema";
import { ADMIN_PAGE_SIZE, pageOffset } from "./utils";

export async function listAuditLogs(opts: { action?: string; targetId?: string; page: number }) {
  const where = and(
    opts.action ? ilike(auditLogs.action, `${opts.action.replace(/[\\%_]/g, (c) => `\\${c}`)}%`) : undefined,
    opts.targetId ? eq(auditLogs.targetId, opts.targetId) : undefined,
  );
  const [rows, total] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        metadata: auditLogs.metadata,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
        actorId: auditLogs.actorId,
        actorName: profiles.displayName,
      })
      .from(auditLogs)
      .leftJoin(profiles, eq(profiles.userId, auditLogs.actorId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(opts.page)),
    db.select({ n: count() }).from(auditLogs).where(where),
  ]);
  return { rows, total: total[0]?.n ?? 0 };
}
