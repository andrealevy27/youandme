import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "../db";
import { bookings, consultantProfiles, profiles, reviews } from "../db/schema";
import { AppError, forbidden, notFound } from "../errors";
import { notify } from "../notifications";
import { track } from "../analytics";

const score = z.coerce.number().int().min(1, "Rate from 1 to 5.").max(5, "Rate from 1 to 5.");

export const submitReviewInput = z.object({
  bookingId: z.string().uuid(),
  expertise: score,
  communication: score,
  value: score,
  reliability: score,
  body: z.string().trim().max(3000).optional().transform((v) => v || null),
});

/** Overall = rounded mean of the four dimensions (pure). */
export function overallScore(s: { expertise: number; communication: number; value: number; reliability: number }): number {
  return Math.round((s.expertise + s.communication + s.value + s.reliability) / 4);
}

/**
 * Recompute a consultant's rating aggregates from published reviews. The ONLY
 * writer of consultant_profiles.rating_avg / review_count.
 */
export async function recomputeConsultantRating(consultantId: string, conn: DbOrTx = db) {
  await conn.execute(sql`
    update ${consultantProfiles} set
      rating_avg = sub.avg, review_count = sub.n, updated_at = now()
    from (
      select avg(overall)::real as avg, count(*)::int as n from ${reviews}
      where consultant_id = ${consultantId} and status = 'published'
    ) sub
    where ${consultantProfiles.userId} = ${consultantId}`);
}

/** Only the booking's client, only once, only after the booking is completed. */
export async function submitReview(viewerId: string, raw: z.input<typeof submitReviewInput>) {
  const input = submitReviewInput.parse(raw);
  const overall = overallScore(input);
  const review = await db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId)).for("update").limit(1);
    if (!b) throw notFound("That booking");
    if (b.clientId !== viewerId) throw forbidden("Only the person who booked can review this session.");
    if (b.status !== "completed") throw new AppError("CONFLICT", "You can review a session once it's been completed.");
    const [existing] = await tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, b.id)).limit(1);
    if (existing) throw new AppError("CONFLICT", "You've already reviewed this session.");
    const [created] = await tx
      .insert(reviews)
      .values({
        bookingId: b.id,
        consultantId: b.consultantId,
        reviewerId: viewerId,
        expertise: input.expertise,
        communication: input.communication,
        value: input.value,
        reliability: input.reliability,
        overall,
        body: input.body,
      })
      .returning();
    await recomputeConsultantRating(b.consultantId, tx);
    return created!;
  });

  const [reviewer] = await db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.userId, viewerId)).limit(1);
  await notify({
    userId: review.consultantId,
    type: "booking",
    title: `${reviewer?.name ?? "A client"} left you a ${overall}-star review`,
    body: review.body ? review.body.slice(0, 140) : undefined,
    href: `/bookings/${review.bookingId}`,
    actorId: viewerId,
  });
  track("review_submitted", viewerId, { consultantId: review.consultantId, overall });
  return review;
}

/** For moderation (admin panel): hide/show a review and keep aggregates correct. */
export async function setReviewStatus(reviewId: string, status: "published" | "hidden") {
  await db.transaction(async (tx) => {
    const [r] = await tx.update(reviews).set({ status }).where(and(eq(reviews.id, reviewId))).returning();
    if (!r) throw notFound("That review");
    await recomputeConsultantRating(r.consultantId, tx);
  });
}
