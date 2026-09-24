import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { consultantProfiles, profiles, reports, savedItems } from "../db/schema";
import { AppError, notFound } from "../errors";
import { enforceRateLimit } from "../rate-limit";
import { REPORT_REASONS } from "@/lib/domain";

/** Save/unsave a consultant to the viewer's saved items. Returns the new state. */
export async function setConsultantSaved(viewerId: string, consultantId: string, saved: boolean): Promise<boolean> {
  if (viewerId === consultantId) throw new AppError("VALIDATION", "You can't save your own profile.");
  if (saved) {
    const [c] = await db.select({ id: consultantProfiles.userId }).from(consultantProfiles).where(eq(consultantProfiles.userId, consultantId)).limit(1);
    if (!c) throw notFound("That consultant");
    await db.insert(savedItems).values({ userId: viewerId, targetType: "consultant", targetId: consultantId }).onConflictDoNothing();
    return true;
  }
  await db.delete(savedItems).where(and(eq(savedItems.userId, viewerId), eq(savedItems.targetType, "consultant"), eq(savedItems.targetId, consultantId)));
  return false;
}

export const reportConsultantInput = z.object({
  consultantId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional().transform((v) => v || null),
});

/** Report a consultant profile to moderation, with a snapshot of what was shown. */
export async function reportConsultant(viewerId: string, raw: z.input<typeof reportConsultantInput>) {
  const input = reportConsultantInput.parse(raw);
  if (input.consultantId === viewerId) throw new AppError("VALIDATION", "You can't report yourself.");
  enforceRateLimit("report", viewerId);
  const [row] = await db
    .select({ c: consultantProfiles, name: profiles.displayName, handle: profiles.handle })
    .from(consultantProfiles)
    .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
    .where(eq(consultantProfiles.userId, input.consultantId))
    .limit(1);
  if (!row) throw notFound("That consultant");
  await db.insert(reports).values({
    reporterId: viewerId,
    targetType: "consultant",
    targetId: input.consultantId,
    reason: input.reason,
    details: input.details,
    snapshot: { name: row.name, handle: row.handle, headline: row.c.headline, bio: row.c.bio },
  });
}
