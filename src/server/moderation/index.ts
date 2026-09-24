import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { blocks, consultantProfiles, messages, profiles, reports, reviews, startups } from "../db/schema";
import { AppError, notFound } from "../errors";
import { assertMember } from "../messaging";
import { enforceRateLimit } from "../rate-limit";
import type { ReportTarget } from "@/lib/domain";
import { isSelfReport, reportInput, type ReportInput } from "./schema";

export { reportInput, type ReportInput } from "./schema";

/**
 * Capture what the reporter saw, so moderators can act even if the content is later
 * edited or deleted. Also enforces that the reporter could actually see it.
 */
async function snapshotFor(reporterId: string, type: ReportTarget, targetId: string): Promise<{ snapshot: Record<string, unknown>; ownerId: string | null }> {
  switch (type) {
    case "user": {
      const [p] = await db.select().from(profiles).where(eq(profiles.userId, targetId)).limit(1);
      if (!p) throw notFound("That person");
      return {
        ownerId: p.userId,
        snapshot: { handle: p.handle, displayName: p.displayName, headline: p.headline, bio: p.bio, avatarUrl: p.avatarUrl, location: p.location },
      };
    }
    case "consultant": {
      const [c] = await db
        .select({ userId: consultantProfiles.userId, headline: consultantProfiles.headline, bio: consultantProfiles.bio, name: profiles.displayName, handle: profiles.handle })
        .from(consultantProfiles)
        .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
        .where(eq(consultantProfiles.userId, targetId))
        .limit(1);
      if (!c) throw notFound("That consultant");
      return { ownerId: c.userId, snapshot: { ...c } };
    }
    case "startup": {
      const [s] = await db.select().from(startups).where(eq(startups.id, targetId)).limit(1);
      if (!s || s.deletedAt) throw notFound("That startup");
      return {
        ownerId: s.createdById,
        snapshot: { name: s.name, slug: s.slug, tagline: s.tagline, description: s.description, websiteUrl: s.websiteUrl, logoUrl: s.logoUrl },
      };
    }
    case "message": {
      const [m] = await db.select().from(messages).where(eq(messages.id, targetId)).limit(1);
      if (!m) throw notFound("That message");
      // You can only report messages from conversations you're in.
      await assertMember(m.conversationId, reporterId);
      return {
        ownerId: m.senderId,
        snapshot: {
          conversationId: m.conversationId,
          senderId: m.senderId,
          kind: m.kind,
          body: m.body,
          attachments: m.attachments,
          createdAt: m.createdAt.toISOString(),
          deletedAt: m.deletedAt?.toISOString() ?? null,
        },
      };
    }
    case "review": {
      const [r] = await db.select().from(reviews).where(eq(reviews.id, targetId)).limit(1);
      if (!r) throw notFound("That review");
      return {
        ownerId: r.reviewerId,
        snapshot: { consultantId: r.consultantId, reviewerId: r.reviewerId, overall: r.overall, body: r.body, createdAt: r.createdAt.toISOString() },
      };
    }
  }
}

/**
 * File a report. Rate limited; one open report per reporter + target (a repeat
 * returns the existing report instead of creating noise for moderators).
 */
export async function reportContent(reporterId: string, raw: ReportInput) {
  const input = reportInput.parse(raw);
  enforceRateLimit("report", reporterId);
  const { snapshot, ownerId } = await snapshotFor(reporterId, input.targetType, input.targetId);
  if (isSelfReport(input.targetType, ownerId, reporterId)) throw new AppError("VALIDATION", "You can't report your own content.");

  const [existing] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, reporterId),
        eq(reports.targetType, input.targetType),
        eq(reports.targetId, input.targetId),
        inArray(reports.status, ["open", "reviewing"]),
      ),
    )
    .limit(1);
  if (existing) return { id: existing.id, duplicate: true };

  const [row] = await db
    .insert(reports)
    .values({
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details || null,
      snapshot: { ...snapshot, ownerId },
    })
    .returning({ id: reports.id });
  return { id: row!.id, duplicate: false };
}

/**
 * Block someone. Blocks are symmetric in effect: neither person can message the other,
 * their 1:1 thread disappears from both inboxes, and profiles/recommendations hide them.
 */
export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new AppError("VALIDATION", "You can't block yourself.");
  const [target] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, blockedId)).limit(1);
  if (!target) throw notFound("That person");
  await db.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await db.delete(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
}

/** Has `blockerId` blocked `blockedId` (one direction — used to render Block/Unblock). */
export async function hasBlocked(blockerId: string, blockedId: string) {
  const [row] = await db
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
    .limit(1);
  return !!row;
}

/** People the user has blocked (for Settings → Privacy). */
export async function listBlocked(userId: string) {
  return db
    .select({ userId: profiles.userId, name: profiles.displayName, handle: profiles.handle, avatarUrl: profiles.avatarUrl, blockedAt: blocks.createdAt })
    .from(blocks)
    .innerJoin(profiles, eq(profiles.userId, blocks.blockedId))
    .where(eq(blocks.blockerId, userId))
    .orderBy(desc(blocks.createdAt));
}

/** Any block between two users, either direction. */
export async function blockBetween(a: string, b: string) {
  const [row] = await db
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))))
    .limit(1);
  return row ?? null;
}
