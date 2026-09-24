import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { messages, profiles, reports, startups } from "../db/schema";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import type { Viewer } from "../auth/session";
import { ADMIN_PAGE_SIZE, pageOffset } from "./utils";
import { setReviewStatus } from "./reviews";

export const REPORT_STATUSES = ["open", "reviewing", "actioned", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export async function listReports(opts: { status: ReportStatus; page: number }) {
  const where = eq(reports.status, opts.status);
  const [rows, total, counts] = await Promise.all([
    db
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        reason: reports.reason,
        details: reports.details,
        snapshot: reports.snapshot,
        status: reports.status,
        resolution: reports.resolution,
        createdAt: reports.createdAt,
        resolvedAt: reports.resolvedAt,
        reporterId: reports.reporterId,
        reporterName: profiles.displayName,
        reporterHandle: profiles.handle,
      })
      .from(reports)
      .leftJoin(profiles, eq(profiles.userId, reports.reporterId))
      .where(where)
      // Oldest open reports first so nothing starves; newest first for closed tabs.
      .orderBy(opts.status === "open" || opts.status === "reviewing" ? reports.createdAt : desc(reports.resolvedAt), desc(reports.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(opts.page)),
    db.select({ n: count() }).from(reports).where(where),
    db.select({ status: reports.status, n: count() }).from(reports).groupBy(reports.status),
  ]);
  const byStatus = Object.fromEntries(REPORT_STATUSES.map((s) => [s, 0])) as Record<ReportStatus, number>;
  for (const c of counts) byStatus[c.status] = c.n;
  return { rows, total: total[0]?.n ?? 0, byStatus };
}

async function load(id: string) {
  const [row] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!row) throw notFound("That report");
  return row;
}

async function resolve(actor: Viewer, id: string, status: "actioned" | "dismissed", resolution: string | null, extra?: Record<string, unknown>) {
  const updated = await db
    .update(reports)
    .set({ status, resolution, resolvedById: actor.userId, resolvedAt: new Date() })
    .where(and(eq(reports.id, id), inArray(reports.status, ["open", "reviewing"])))
    .returning({ id: reports.id, targetType: reports.targetType, targetId: reports.targetId });
  const row = updated[0];
  if (!row) throw new AppError("CONFLICT", "This report has already been resolved.");
  await audit({
    actorId: actor.userId,
    action: `report.${status}`,
    targetType: "report",
    targetId: id,
    metadata: { reportTargetType: row.targetType, reportTargetId: row.targetId, resolution, ...extra },
  });
}

export async function markReportReviewing(actor: Viewer, id: string) {
  const updated = await db
    .update(reports)
    .set({ status: "reviewing" })
    .where(and(eq(reports.id, id), eq(reports.status, "open")))
    .returning({ id: reports.id });
  if (!updated.length) throw new AppError("CONFLICT", "Only open reports can be moved to reviewing.");
  await audit({ actorId: actor.userId, action: "report.reviewing", targetType: "report", targetId: id });
}

export async function dismissReport(actor: Viewer, input: { id: string; note?: string }) {
  await resolve(actor, input.id, "dismissed", input.note?.trim() || null);
}

export async function actionReport(actor: Viewer, input: { id: string; resolution: string }) {
  await resolve(actor, input.id, "actioned", input.resolution);
}

/** Content targets an admin can take down directly from the report. */
export const REMOVABLE_TARGETS = ["message", "review", "startup"] as const;

export async function removeReportedContent(actor: Viewer, input: { id: string; resolution: string }) {
  const report = await load(input.id);
  if (report.status !== "open" && report.status !== "reviewing") throw new AppError("CONFLICT", "This report has already been resolved.");

  switch (report.targetType) {
    case "message": {
      const res = await db
        .update(messages)
        .set({ deletedAt: new Date() })
        .where(and(eq(messages.id, report.targetId), isNull(messages.deletedAt)))
        .returning({ id: messages.id });
      await audit({ actorId: actor.userId, action: "message.removed", targetType: "message", targetId: report.targetId, metadata: { reportId: report.id, alreadyRemoved: !res.length } });
      break;
    }
    case "review": {
      try {
        await setReviewStatus(actor, { id: report.targetId, status: "hidden", reason: `Report ${report.id}` });
      } catch (err) {
        // Already hidden is fine — the goal state is reached.
        if (!(err instanceof AppError && err.code === "CONFLICT")) throw err;
      }
      break;
    }
    case "startup": {
      const [s] = await db.select({ visibility: startups.visibility }).from(startups).where(eq(startups.id, report.targetId)).limit(1);
      if (!s) throw notFound("The reported startup");
      if (s.visibility !== "hidden") {
        await db.update(startups).set({ visibility: "hidden" }).where(eq(startups.id, report.targetId));
        await audit({
          actorId: actor.userId,
          action: "startup.hidden",
          targetType: "startup",
          targetId: report.targetId,
          metadata: { previousVisibility: s.visibility, reportId: report.id },
        });
      }
      break;
    }
    default:
      throw new AppError("VALIDATION", "People and consultant reports are handled from the user's admin page.");
  }
  await resolve(actor, report.id, "actioned", input.resolution, { contentRemoved: true });
}
