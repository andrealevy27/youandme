import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { cofounderTrials, eventAttendees, eventIntroductions, events, matches, profiles } from "../db/schema";
import { SCHOOLS } from "@/lib/schools";

/**
 * Organizer dashboard. Aggregate counts only — never names, profiles or who matched with whom —
 * so it can be shared with a partner like an entrepreneurship center.
 */
export async function getEventFunnel(eventId: string) {
  const attendees = db.select({ id: eventAttendees.userId }).from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
  const pairAmongAttendees = (a: typeof matches.userAId | typeof cofounderTrials.userAId, b: typeof matches.userBId | typeof cofounderTrials.userBId) =>
    and(inArray(a, attendees), inArray(b, attendees));
  const [[att], [intro], [m], [t]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(eventAttendees).where(eq(eventAttendees.eventId, eventId)),
    db.select({ n: sql<number>`count(*)::int` }).from(eventIntroductions).where(eq(eventIntroductions.eventId, eventId)),
    db.select({ n: sql<number>`count(*)::int` }).from(matches).where(and(pairAmongAttendees(matches.userAId, matches.userBId), isNull(matches.unmatchedAt))),
    db
      .select({
        started: sql<number>`count(*)::int`,
        continuing: sql<number>`count(*) filter (where ${cofounderTrials.decisionA} = 'continue' and ${cofounderTrials.decisionB} = 'continue')::int`,
      })
      .from(cofounderTrials)
      .where(pairAmongAttendees(cofounderTrials.userAId, cofounderTrials.userBId)),
  ]);
  return {
    attendees: att?.n ?? 0,
    introductions: intro?.n ?? 0,
    matches: m?.n ?? 0,
    trialsStarted: t?.started ?? 0,
    trialsContinuing: t?.continuing ?? 0,
  };
}

export async function getPartnerOverview() {
  const [bySchool, [att], [m], [t], eventRows] = await Promise.all([
    db
      .select({ school: profiles.school, n: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(isNotNull(profiles.schoolVerifiedAt), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
      .groupBy(profiles.school),
    db.select({ n: sql<number>`count(distinct ${eventAttendees.userId})::int` }).from(eventAttendees),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(matches)
      .where(
        and(
          isNull(matches.unmatchedAt),
          sql`exists (select 1 from ${eventAttendees} x join ${eventAttendees} y on x.event_id = y.event_id where x.user_id = ${matches.userAId} and y.user_id = ${matches.userBId})`,
        ),
      ),
    db
      .select({
        started: sql<number>`count(*)::int`,
        continuing: sql<number>`count(*) filter (where ${cofounderTrials.decisionA} = 'continue' and ${cofounderTrials.decisionB} = 'continue')::int`,
      })
      .from(cofounderTrials),
    db.select({ id: events.id }).from(events),
  ]);
  const counts = new Map(bySchool.map((r) => [r.school, r.n]));
  return {
    verifiedStudents: SCHOOLS.map((s) => ({ school: s.shortName, n: counts.get(s.slug) ?? 0 })),
    events: eventRows.length,
    attendees: att?.n ?? 0,
    eventMatches: m?.n ?? 0,
    trialsStarted: t?.started ?? 0,
    trialsContinuing: t?.continuing ?? 0,
  };
}
