import "server-only";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../db";
import { consultantProfiles, profiles, user, userRoles } from "../db/schema";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { notify } from "../notifications";
import type { Viewer } from "../auth/session";
import { ADMIN_PAGE_SIZE, likePattern, pageOffset } from "./utils";

export const CONSULTANT_STATUSES = ["draft", "pending_review", "approved", "rejected", "suspended"] as const;
export type ConsultantStatus = (typeof CONSULTANT_STATUSES)[number];

export async function listConsultants(opts: { status: ConsultantStatus | "all"; q?: string; page: number }) {
  const filters: (SQL | undefined)[] = [];
  if (opts.status !== "all") filters.push(eq(consultantProfiles.status, opts.status));
  if (opts.q) {
    const p = likePattern(opts.q);
    filters.push(or(ilike(profiles.displayName, p), ilike(consultantProfiles.headline, p), ilike(user.email, p)));
  }
  const where = and(...filters);
  const [rows, total, pending] = await Promise.all([
    db
      .select({
        userId: consultantProfiles.userId,
        name: profiles.displayName,
        handle: profiles.handle,
        email: user.email,
        headline: consultantProfiles.headline,
        status: consultantProfiles.status,
        featured: consultantProfiles.featured,
        ratingAvg: consultantProfiles.ratingAvg,
        reviewCount: consultantProfiles.reviewCount,
        hourlyRateCents: consultantProfiles.hourlyRateCents,
        currency: consultantProfiles.currency,
        stripeChargesEnabled: consultantProfiles.stripeChargesEnabled,
        isDemo: profiles.isDemo,
        updatedAt: consultantProfiles.updatedAt,
      })
      .from(consultantProfiles)
      .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
      .innerJoin(user, eq(user.id, consultantProfiles.userId))
      .where(where)
      // Oldest submissions first in the review queue; most recently updated first elsewhere.
      .orderBy(opts.status === "pending_review" ? consultantProfiles.updatedAt : desc(consultantProfiles.updatedAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(opts.page)),
    db
      .select({ n: count() })
      .from(consultantProfiles)
      .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
      .innerJoin(user, eq(user.id, consultantProfiles.userId))
      .where(where),
    db.select({ n: count() }).from(consultantProfiles).where(eq(consultantProfiles.status, "pending_review")),
  ]);
  return { rows, total: total[0]?.n ?? 0, pendingCount: pending[0]?.n ?? 0 };
}

async function load(userId: string) {
  const [row] = await db.select({ status: consultantProfiles.status }).from(consultantProfiles).where(eq(consultantProfiles.userId, userId)).limit(1);
  if (!row) throw notFound("That consultant profile");
  return row;
}

export async function reviewConsultant(
  actor: Viewer,
  input: { userId: string; decision: "approved" | "rejected" | "suspended"; reason?: string },
) {
  const current = await load(input.userId);
  if (current.status === input.decision) throw new AppError("CONFLICT", `This consultant is already ${input.decision.replace("_", " ")}.`);
  if (input.decision === "approved" && current.status === "draft") {
    throw new AppError("CONFLICT", "This profile is still a draft — the consultant hasn't submitted it for review.");
  }
  await db
    .update(consultantProfiles)
    .set({ status: input.decision, ...(input.decision !== "approved" && { featured: false }) })
    .where(eq(consultantProfiles.userId, input.userId));
  if (input.decision === "approved") {
    await db.insert(userRoles).values({ userId: input.userId, role: "consultant" }).onConflictDoNothing();
  }
  await audit({
    actorId: actor.userId,
    action: `consultant.${input.decision}`,
    targetType: "consultant",
    targetId: input.userId,
    metadata: { previousStatus: current.status, reason: input.reason ?? null },
  });
  const copy = {
    approved: {
      title: "Your consultant profile is live",
      body: "You've been approved. Founders can now find and book you on You&Me.",
    },
    rejected: {
      title: "Your consultant profile needs changes",
      body: `We couldn't approve your consultant profile yet.${input.reason ? ` Reason: ${input.reason}` : ""} Update it and resubmit from your workspace.`,
    },
    suspended: {
      title: "Your consultant profile has been paused",
      body: `Your consultant listing is hidden and can't take new bookings.${input.reason ? ` Reason: ${input.reason}` : ""}`,
    },
  }[input.decision];
  await notify({ userId: input.userId, type: "system", title: copy.title, body: copy.body, href: "/consultant", actorId: actor.userId });
}

export async function setConsultantFeatured(actor: Viewer, input: { userId: string; featured: boolean }) {
  const current = await load(input.userId);
  if (input.featured && current.status !== "approved") throw new AppError("CONFLICT", "Only approved consultants can be featured.");
  await db.update(consultantProfiles).set({ featured: input.featured }).where(eq(consultantProfiles.userId, input.userId));
  await audit({
    actorId: actor.userId,
    action: input.featured ? "consultant.featured" : "consultant.unfeatured",
    targetType: "consultant",
    targetId: input.userId,
  });
}
