import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { consultantProfiles, identityVerifications, reports } from "../db/schema";
import { hasAdminPermission } from "../authz/admin";
import type { AdminRole } from "@/lib/domain";

/** Work waiting for a human, used for nav badges. Only counts queues the admin can act on. */
export async function adminQueueCounts(role: AdminRole | null) {
  const [openReports, pendingConsultants, pendingVerifications] = await Promise.all([
    hasAdminPermission(role, "reports.handle")
      ? db.select({ n: count() }).from(reports).where(eq(reports.status, "open")).then((r) => r[0]?.n ?? 0)
      : 0,
    hasAdminPermission(role, "consultants.review")
      ? db.select({ n: count() }).from(consultantProfiles).where(eq(consultantProfiles.status, "pending_review")).then((r) => r[0]?.n ?? 0)
      : 0,
    hasAdminPermission(role, "verification.review")
      ? db
          .select({ n: count() })
          .from(identityVerifications)
          .where(and(eq(identityVerifications.status, "pending"), inArray(identityVerifications.type, ["identity", "linkedin", "university_email"])))
          .then((r) => r[0]?.n ?? 0)
      : 0,
  ]);
  return { "/admin/reports": openReports, "/admin/consultants": pendingConsultants, "/admin/verification": pendingVerifications } as Record<string, number>;
}
