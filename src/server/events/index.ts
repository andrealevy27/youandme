import { and, asc, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { eventAttendees, eventIntroductions, events, interests, matches, profiles } from "../db/schema";
import { AppError } from "../errors";
import { track } from "../analytics";
import { audit } from "../audit";
import { activeScorer } from "../matching";
import { loadMatchProfiles } from "../matching/profiles";
import { getMatchWeights } from "../matching/weights";
import { discoverableProfile, getBlockedIds } from "../privacy/visibility";
import { getPersonSummaries, type PersonSummary } from "../people";
import { canSeeStudents } from "../student";
import { oneLineReason, studentReasons, type StudentFacts } from "../student/reasons";
import { SCHOOLS, schoolBySlug } from "@/lib/schools";

export const INTROS_PER_EVENT = 5;

// No 0/O/1/I/L so codes read cleanly off a projector.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "Thu, Mar 12 · 6:30 PM" in the event's own time zone. */
export function formatEventTime(e: { startsAt: Date; timezone: string }) {
  const d = e.startsAt;
  const tz = e.timezone;
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}`;
}

export const createEventSchema = z.object({
  name: z.string().trim().min(3, "Give the event a name.").max(120),
  startsAt: z.coerce.date({ message: "Pick a date and time." }),
  timezone: z
    .string()
    .max(64)
    .optional()
    .transform((v) => (v && isValidTimeZone(v) ? v : "America/New_York")),
  school: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || SCHOOLS.some((s) => s.slug === v), "Unknown school."),
  location: z.string().trim().max(160).optional().transform((v) => v || null),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
});

/** Admin-only (checked by the caller with `requireAdmin("events.manage")`). */
export async function createEvent(adminId: string, raw: z.input<typeof createEventSchema>) {
  const input = createEventSchema.parse(raw);
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const [row] = await db
      .insert(events)
      .values({ ...input, code, createdBy: adminId })
      .onConflictDoNothing()
      .returning();
    if (row) {
      await audit({ actorId: adminId, action: "event.create", targetType: "event", targetId: row.id });
      return row;
    }
  }
  throw new AppError("CONFLICT", "Couldn't generate a unique event code. Try again.");
}

export async function setEventStatus(adminId: string, eventId: string, status: "active" | "closed") {
  const [row] = await db.update(events).set({ status }).where(eq(events.id, eventId)).returning();
  if (!row) throw new AppError("NOT_FOUND", "Event not found.");
  await audit({ actorId: adminId, action: `event.${status === "closed" ? "close" : "reopen"}`, targetType: "event", targetId: eventId });
  return row;
}

export async function listEvents() {
  return db
    .select({
      event: events,
      attendees: sql<number>`(select count(*)::int from ${eventAttendees} a where a.event_id = ${events.id})`,
    })
    .from(events)
    .orderBy(desc(events.startsAt));
}

export async function getEventByCode(code: string) {
  const [row] = await db.select().from(events).where(eq(events.code, code.trim().toUpperCase())).limit(1);
  return row ?? null;
}

export async function getEventById(id: string) {
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return row ?? null;
}

export async function isAttendee(eventId: string, userId: string) {
  const [row] = await db
    .select({ id: eventAttendees.userId })
    .from(eventAttendees)
    .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, userId)))
    .limit(1);
  return !!row;
}

export async function joinEvent(userId: string, code: string) {
  const event = await getEventByCode(code);
  if (!event) throw new AppError("NOT_FOUND", "We couldn't find that event. Check the code.");
  if (event.status !== "active") throw new AppError("VALIDATION", "This event has ended and isn't taking new attendees.");
  if (event.school) {
    const [p] = await db.select({ school: profiles.school }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (p?.school !== event.school) {
      throw new AppError("FORBIDDEN", `This event is for ${schoolBySlug(event.school)?.shortName ?? "its host school's"} students.`);
    }
  }
  const inserted = await db.insert(eventAttendees).values({ eventId: event.id, userId }).onConflictDoNothing().returning();
  if (inserted.length) track("event_joined", userId, { eventId: event.id });
  return event;
}

export async function listMyEvents(userId: string) {
  return db
    .select({ event: events, joinedAt: eventAttendees.joinedAt })
    .from(eventAttendees)
    .innerJoin(events, eq(events.id, eventAttendees.eventId))
    .where(eq(eventAttendees.userId, userId))
    .orderBy(desc(events.startsAt));
}

async function studentFacts(ids: string[]): Promise<Map<string, StudentFacts>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({
      id: profiles.userId,
      name: profiles.displayName,
      school: profiles.school,
      ideaStatus: profiles.ideaStatus,
      ideaSummary: profiles.ideaSummary,
      weeklyHours: profiles.weeklyHours,
      summerPlans: profiles.summerPlans,
    })
    .from(profiles)
    .where(inArray(profiles.userId, ids));
  return new Map(rows.map(({ id, ...f }) => [id, f]));
}

/**
 * Score `candidateIds` for the viewer and return them best-first with plain reasons.
 * Shared by event introductions and the demo; pure scoring lives in the matching engine.
 */
export async function rankWithReasons(viewerId: string, candidateIds: string[]) {
  if (!candidateIds.length) return [];
  const [profilesMap, facts, weights] = await Promise.all([loadMatchProfiles([viewerId, ...candidateIds]), studentFacts([viewerId, ...candidateIds]), getMatchWeights()]);
  const viewer = profilesMap.get(viewerId);
  const viewerFacts = facts.get(viewerId);
  if (!viewer || !viewerFacts) return [];
  return candidateIds
    .map((id) => {
      const c = profilesMap.get(id);
      const f = facts.get(id);
      if (!c || !f) return null;
      const result = activeScorer.score(viewer, c, weights);
      return { userId: id, result, oneLiner: oneLineReason(viewerFacts, f, result), reasons: studentReasons(viewerFacts, f, result) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.result.score - a.result.score);
}

export type EventIntro = {
  person: PersonSummary;
  reason: string;
  rank: number;
  /** "none" | "interested" (you said yes) | "matched" (both said yes) */
  status: "none" | "interested" | "matched";
  /** Set once matched: the conversation to continue in. */
  conversationId: string | null;
};

/**
 * "Your 5 people to meet tonight". Only other attendees the viewer is allowed to see (verified,
 * visible, within both people's campus scope, not blocked). Stored so the list stays stable and
 * remains after the event; while the event is active, empty slots fill in as more people join.
 */
export async function getEventIntroductions(viewer: { userId: string; adminRole: string | null }, eventId: string): Promise<EventIntro[]> {
  const viewerId = viewer.userId;
  if (!(await isAttendee(eventId, viewerId))) throw new AppError("FORBIDDEN", "Join the event to see who to meet.");
  if (!(await canSeeStudents(viewer))) return [];
  const event = await getEventById(eventId);
  if (!event) throw new AppError("NOT_FOUND", "Event not found.");

  let stored = await db
    .select()
    .from(eventIntroductions)
    .where(and(eq(eventIntroductions.eventId, eventId), eq(eventIntroductions.userId, viewerId)))
    .orderBy(asc(eventIntroductions.rank));

  if (stored.length < INTROS_PER_EVENT && event.status === "active") {
    const blocked = [...(await getBlockedIds(viewerId))];
    const exclude = [...blocked, ...stored.map((s) => s.targetId)];
    const attendeeIds = db.select({ id: eventAttendees.userId }).from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
    const rows = await db
      .select({ id: profiles.userId })
      .from(profiles)
      .where(
        and(
          inArray(profiles.userId, attendeeIds),
          ne(profiles.userId, viewerId),
          discoverableProfile(viewerId),
          exclude.length ? notInArray(profiles.userId, exclude) : undefined,
        ),
      )
      .limit(300);
    const ranked = await rankWithReasons(
      viewerId,
      rows.map((r) => r.id),
    );
    const fresh = ranked.slice(0, INTROS_PER_EVENT - stored.length);
    if (fresh.length) {
      await db
        .insert(eventIntroductions)
        .values(fresh.map((r, i) => ({ eventId, userId: viewerId, targetId: r.userId, rank: stored.length + i + 1, reason: r.oneLiner })))
        .onConflictDoNothing();
      stored = await db
        .select()
        .from(eventIntroductions)
        .where(and(eq(eventIntroductions.eventId, eventId), eq(eventIntroductions.userId, viewerId)))
        .orderBy(asc(eventIntroductions.rank));
    }
  }
  if (!stored.length) return [];

  const ids = stored.map((s) => s.targetId);
  const [people, liked, matched] = await Promise.all([
    getPersonSummaries(ids),
    db
      .select({ id: interests.toUserId })
      .from(interests)
      .where(and(eq(interests.fromUserId, viewerId), eq(interests.kind, "interested"), inArray(interests.toUserId, ids))),
    db
      .select({ conversationId: matches.conversationId, a: matches.userAId, b: matches.userBId })
      .from(matches)
      .where(and(sql`${matches.unmatchedAt} is null`, sql`(${matches.userAId} = ${viewerId} or ${matches.userBId} = ${viewerId})`)),
  ]);
  const byId = new Map(people.map((p) => [p.userId, p]));
  const likedSet = new Set(liked.map((l) => l.id));
  const matchByOther = new Map(matched.map((m) => [m.a === viewerId ? m.b : m.a, m.conversationId]));
  return stored
    .filter((s) => byId.has(s.targetId))
    .map((s) => ({
      person: byId.get(s.targetId)!,
      reason: s.reason,
      rank: s.rank,
      status: matchByOther.has(s.targetId) ? "matched" : likedSet.has(s.targetId) ? "interested" : "none",
      conversationId: matchByOther.get(s.targetId) ?? null,
    }));
}

/** Organizer numbers for one event (counts only — no profile details). */
export async function getEventStats(eventId: string) {
  const attendeeIds = db.select({ id: eventAttendees.userId }).from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
  const [[a], [intro], [m]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(eventAttendees).where(eq(eventAttendees.eventId, eventId)),
    db.select({ n: sql<number>`count(*)::int` }).from(eventIntroductions).where(eq(eventIntroductions.eventId, eventId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(inArray(matches.userAId, attendeeIds), inArray(matches.userBId, attendeeIds))),
  ]);
  return { attendees: a?.n ?? 0, introductions: intro?.n ?? 0, matches: m?.n ?? 0 };
}
