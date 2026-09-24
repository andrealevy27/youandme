import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { bookings, needs, personalityProfiles, profiles, startupMembers } from "../db/schema";
import { getProfileCompletion } from "../people";
import { getPrimaryStartup } from "../startups";

export type RecommendedAction = { key: string; title: string; description: string; href: string; cta: string };

/**
 * Next best actions, derived from the user's real state. No fake urgency:
 * each item names a concrete benefit and disappears once done.
 */
export async function getRecommendedActions(userId: string): Promise<RecommendedAction[]> {
  const [[profile], [quiz], completion, startup, [needCount]] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)),
    db.select({ id: personalityProfiles.userId }).from(personalityProfiles).where(eq(personalityProfiles.userId, userId)),
    getProfileCompletion(userId),
    getPrimaryStartup(userId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(needs)
      .where(and(eq(needs.ownerId, userId), eq(needs.status, "open"))),
  ]);
  if (!profile) return [];
  const out: RecommendedAction[] = [];
  if (!quiz) {
    out.push({ key: "quiz", title: "Complete your compatibility quiz", description: "Unlocks explained compatibility and friction warnings on every match.", href: "/quiz", cta: "Take quiz" });
  }
  if (!needCount?.n) {
    out.push({ key: "needs", title: "Tell us what you need", description: "Needs drive who we recommend — cofounders, consultants and talent.", href: "/needs", cta: "Add a need" });
  }
  if (startup) {
    const s = startup.startup;
    if (!s.traction) {
      out.push({ key: "traction", title: "Add your startup traction", description: "Concrete progress helps cofounders and talent take you seriously.", href: `/startups/${s.slug}/edit`, cta: "Add traction" });
    }
    const [members] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(startupMembers)
      .where(and(eq(startupMembers.startupId, s.id), sql`${startupMembers.removedAt} is null`));
    if ((members?.n ?? 0) <= 1 && !profile.lookingForCofounder) {
      out.push({ key: "invite", title: "Invite your cofounder", description: "Bring your team in so you can book consultants and chat together.", href: `/startups/${s.slug}/team`, cta: "Invite" });
    }
    const [consultantNeed] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(needs)
      .where(and(eq(needs.startupId, s.id), eq(needs.type, "consultant"), eq(needs.status, "open")));
    const [booked] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.clientId, userId), inArray(bookings.status, ["confirmed", "completed"])));
    if ((consultantNeed?.n ?? 0) > 0 && !booked?.n) {
      out.push({ key: "book", title: "Book a consultant", description: "You listed expertise you need. See who can help this week.", href: "/consultants", cta: "Browse" });
    }
  } else if (profile.intents.includes("building")) {
    out.push({ key: "startup", title: "Create your startup profile", description: "An idea is enough. It helps the right people find you.", href: "/startups/new", cta: "Create" });
  }
  if (!profile.linkedinUrl) {
    out.push({ key: "linkedin", title: "Add your LinkedIn", description: "People are more likely to reply when they can see your background.", href: "/profile/edit#links", cta: "Add link" });
  }
  for (const m of completion.missing) {
    if (out.length >= 6) break;
    if (["quiz", "linkedin"].includes(m.key)) continue;
    out.push({ key: `complete-${m.key}`, title: m.label, description: "Makes your matches more accurate.", href: m.href, cta: "Update" });
  }
  return out.slice(0, 5);
}
