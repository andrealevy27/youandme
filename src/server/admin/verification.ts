import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { identityVerifications, profiles, user } from "../db/schema";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { notify } from "../notifications";
import type { Viewer } from "../auth/session";
import { VERIFICATION_LABELS } from "@/lib/domain";
import { ADMIN_PAGE_SIZE, pageOffset } from "./utils";

/** Verification types that need a human decision (email/phone are confirmed automatically). */
export const REVIEWABLE_VERIFICATION_TYPES = ["identity", "linkedin", "university_email"] as const;

export async function listPendingVerifications(page: number) {
  const where = and(eq(identityVerifications.status, "pending"), inArray(identityVerifications.type, [...REVIEWABLE_VERIFICATION_TYPES]));
  const [rows, total] = await Promise.all([
    db
      .select({
        id: identityVerifications.id,
        userId: identityVerifications.userId,
        type: identityVerifications.type,
        subject: identityVerifications.subject,
        createdAt: identityVerifications.createdAt,
        name: profiles.displayName,
        handle: profiles.handle,
        isDemo: profiles.isDemo,
        email: user.email,
      })
      .from(identityVerifications)
      .innerJoin(profiles, eq(profiles.userId, identityVerifications.userId))
      .innerJoin(user, eq(user.id, identityVerifications.userId))
      .where(where)
      .orderBy(identityVerifications.createdAt)
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(page)),
    db.select({ n: count() }).from(identityVerifications).where(where),
  ]);
  return { rows, total: total[0]?.n ?? 0 };
}

export async function recentVerificationDecisions(limit = 15) {
  return db
    .select({
      id: identityVerifications.id,
      type: identityVerifications.type,
      status: identityVerifications.status,
      verifiedAt: identityVerifications.verifiedAt,
      createdAt: identityVerifications.createdAt,
      name: profiles.displayName,
      userId: identityVerifications.userId,
    })
    .from(identityVerifications)
    .innerJoin(profiles, eq(profiles.userId, identityVerifications.userId))
    .where(and(inArray(identityVerifications.status, ["verified", "rejected"]), inArray(identityVerifications.type, [...REVIEWABLE_VERIFICATION_TYPES])))
    .orderBy(desc(identityVerifications.createdAt))
    .limit(limit);
}

export async function decideVerification(actor: Viewer, input: { id: string; decision: "verified" | "rejected"; reason?: string }) {
  const [row] = await db.select().from(identityVerifications).where(eq(identityVerifications.id, input.id)).limit(1);
  if (!row) throw notFound("That verification request");
  if (row.status !== "pending") throw new AppError("CONFLICT", "This request has already been reviewed.");
  if (!(REVIEWABLE_VERIFICATION_TYPES as readonly string[]).includes(row.type)) {
    throw new AppError("VALIDATION", "This verification type is confirmed automatically.");
  }
  const updated = await db
    .update(identityVerifications)
    .set({
      status: input.decision,
      reviewedById: actor.userId,
      verifiedAt: input.decision === "verified" ? new Date() : null,
    })
    .where(and(eq(identityVerifications.id, input.id), eq(identityVerifications.status, "pending")))
    .returning({ id: identityVerifications.id });
  if (!updated.length) throw new AppError("CONFLICT", "This request has already been reviewed.");

  await audit({
    actorId: actor.userId,
    action: input.decision === "verified" ? "verification.approved" : "verification.rejected",
    targetType: "user",
    targetId: row.userId,
    metadata: { verificationId: row.id, type: row.type, reason: input.reason ?? null },
  });
  const label = VERIFICATION_LABELS[row.type];
  await notify({
    userId: row.userId,
    type: "system",
    title: input.decision === "verified" ? `Verified: ${label}` : "We couldn't complete your verification",
    body:
      input.decision === "verified"
        ? "Your verification was approved and the badge now shows on your profile."
        : `Your ${label.toLowerCase()} request wasn't approved.${input.reason ? ` Reason: ${input.reason}` : ""} You can submit a new request from Settings.`,
    href: "/settings",
    actorId: actor.userId,
  });
}
