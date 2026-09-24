import "server-only";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type DbOrTx } from "../db";
import { consultantProfiles, profiles, reviews } from "../db/schema";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import type { Viewer } from "../auth/session";
import { ADMIN_PAGE_SIZE, pageOffset } from "./utils";

/** Rebuild a consultant's public rating from published reviews only. */
export async function recomputeConsultantRating(consultantId: string, conn: DbOrTx = db) {
  const [agg] = await conn
    .select({ avg: sql<number | null>`avg(${reviews.overall})::real`, n: count() })
    .from(reviews)
    .where(and(eq(reviews.consultantId, consultantId), eq(reviews.status, "published")));
  await conn
    .update(consultantProfiles)
    .set({ ratingAvg: agg?.n ? agg.avg : null, reviewCount: agg?.n ?? 0 })
    .where(eq(consultantProfiles.userId, consultantId));
}

const reviewer = alias(profiles, "reviewer");
const consultant = alias(profiles, "consultant");

export async function listReviews(opts: { status: "published" | "hidden" | "all"; page: number }) {
  const where: SQL | undefined = opts.status === "all" ? undefined : eq(reviews.status, opts.status);
  const [rows, total] = await Promise.all([
    db
      .select({
        id: reviews.id,
        overall: reviews.overall,
        expertise: reviews.expertise,
        communication: reviews.communication,
        value: reviews.value,
        reliability: reviews.reliability,
        body: reviews.body,
        status: reviews.status,
        createdAt: reviews.createdAt,
        bookingId: reviews.bookingId,
        consultantId: reviews.consultantId,
        consultantName: consultant.displayName,
        reviewerId: reviews.reviewerId,
        reviewerName: reviewer.displayName,
        isDemo: reviewer.isDemo,
      })
      .from(reviews)
      .leftJoin(consultant, eq(consultant.userId, reviews.consultantId))
      .leftJoin(reviewer, eq(reviewer.userId, reviews.reviewerId))
      .where(where)
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(opts.page)),
    db.select({ n: count() }).from(reviews).where(where),
  ]);
  return { rows, total: total[0]?.n ?? 0 };
}

export async function setReviewStatus(actor: Viewer, input: { id: string; status: "published" | "hidden"; reason?: string }, conn: DbOrTx = db) {
  const [row] = await conn.select({ status: reviews.status, consultantId: reviews.consultantId }).from(reviews).where(eq(reviews.id, input.id)).limit(1);
  if (!row) throw notFound("That review");
  if (row.status === input.status) throw new AppError("CONFLICT", `This review is already ${input.status}.`);
  await conn.update(reviews).set({ status: input.status }).where(eq(reviews.id, input.id));
  await recomputeConsultantRating(row.consultantId, conn);
  await audit(
    {
      actorId: actor.userId,
      action: input.status === "hidden" ? "review.hidden" : "review.unhidden",
      targetType: "review",
      targetId: input.id,
      metadata: { consultantId: row.consultantId, reason: input.reason ?? null },
    },
    conn,
  );
}
