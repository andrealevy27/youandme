import { db, type DbOrTx } from "./db";
import { auditLogs } from "./db/schema";
import { logger } from "./logger";

/** Append-only log for sensitive actions (admin changes, deletions, payments, permission changes). */
export async function audit(
  entry: { actorId: string | null; action: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown>; ip?: string | null },
  conn: DbOrTx = db,
) {
  try {
    await conn.insert(auditLogs).values({ ...entry, ip: entry.ip ?? null });
  } catch (err) {
    // Never let audit failures break the user action, but make them loud.
    logger.error("audit_write_failed", { err, action: entry.action });
  }
}
