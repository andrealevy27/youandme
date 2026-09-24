import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { bookings, consultantAvailability, consultantProfiles, consultantServices, consultantTimeOff } from "../db/schema";
import { notFound } from "../errors";
import { PENDING_PAYMENT_TTL_MINUTES } from "../bookings/state";
import { generateSlots, MAX_SLOT_DAYS, type AvailabilityRule, type BusyInterval, type Slot } from "./slots";
import { toLocalDate } from "./tz";

/** Bookings that currently hold time on the consultant's calendar. */
export function slotHoldingBooking(now = new Date()) {
  const cutoff = new Date(now.getTime() - PENDING_PAYMENT_TTL_MINUTES * 60_000);
  return or(eq(bookings.status, "confirmed"), and(eq(bookings.status, "pending_payment"), gte(bookings.createdAt, cutoff)))!;
}

type Inputs = {
  timezone: string;
  minNoticeHours: number;
  rules: AvailabilityRule[];
  timeOff: string[];
  busy: BusyInterval[];
};

/** Batch-load everything slot generation needs for several consultants in 4 queries. */
export async function loadSlotInputs(consultantIds: string[], from: Date, days: number, conn: DbOrTx = db, now = new Date()) {
  const out = new Map<string, Inputs>();
  if (!consultantIds.length) return out;
  const windowStart = new Date(from.getTime() - 2 * 86_400_000);
  const windowEnd = new Date(from.getTime() + (days + 2) * 86_400_000);
  const [profilesRows, ruleRows, offRows, busyRows] = await Promise.all([
    conn
      .select({ userId: consultantProfiles.userId, timezone: consultantProfiles.timezone, minNoticeHours: consultantProfiles.minNoticeHours })
      .from(consultantProfiles)
      .where(inArray(consultantProfiles.userId, consultantIds)),
    conn.select().from(consultantAvailability).where(inArray(consultantAvailability.consultantId, consultantIds)),
    conn
      .select()
      .from(consultantTimeOff)
      .where(
        and(
          inArray(consultantTimeOff.consultantId, consultantIds),
          gte(consultantTimeOff.day, toLocalDate(windowStart, "UTC")),
          lte(consultantTimeOff.day, toLocalDate(windowEnd, "UTC")),
        ),
      ),
    conn
      .select({ consultantId: bookings.consultantId, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
      .from(bookings)
      .where(
        and(
          inArray(bookings.consultantId, consultantIds),
          slotHoldingBooking(now),
          lte(bookings.startsAt, windowEnd),
          gte(bookings.endsAt, windowStart),
        ),
      ),
  ]);
  for (const p of profilesRows) {
    out.set(p.userId, {
      timezone: p.timezone,
      minNoticeHours: p.minNoticeHours,
      rules: ruleRows.filter((r) => r.consultantId === p.userId),
      timeOff: offRows.filter((r) => r.consultantId === p.userId).map((r) => r.day),
      busy: busyRows.filter((r) => r.consultantId === p.userId),
    });
  }
  return out;
}

export type AvailableSlots = {
  timezone: string;
  durationMinutes: number;
  hasRules: boolean;
  slots: Slot[];
};

/**
 * Real, bookable slots for a service: weekly rules in the consultant's timezone,
 * minus time off, minus live bookings, minus the minimum notice window.
 */
export async function getAvailableSlots(
  consultantId: string,
  serviceId: string,
  fromDate: Date,
  days: number,
  opts: { now?: Date; conn?: DbOrTx } = {},
): Promise<AvailableSlots> {
  const conn = opts.conn ?? db;
  const now = opts.now ?? new Date();
  const [service] = await conn
    .select({ durationMinutes: consultantServices.durationMinutes })
    .from(consultantServices)
    .where(
      and(
        eq(consultantServices.id, serviceId),
        eq(consultantServices.consultantId, consultantId),
        eq(consultantServices.active, true),
        isNull(consultantServices.deletedAt),
      ),
    )
    .limit(1);
  if (!service) throw notFound("That service");
  const n = Math.max(1, Math.min(MAX_SLOT_DAYS, Math.floor(days)));
  const from = fromDate < now ? now : fromDate;
  const inputs = (await loadSlotInputs([consultantId], from, n, conn, now)).get(consultantId);
  if (!inputs) throw notFound("That consultant");
  return {
    timezone: inputs.timezone,
    durationMinutes: service.durationMinutes,
    hasRules: inputs.rules.length > 0,
    slots: generateSlots({ ...inputs, durationMinutes: service.durationMinutes, from, days: n, now }),
  };
}

/** Consultants (from `ids`) with at least one open slot in the next `days` days for their shortest active service. */
export async function consultantsWithOpenSlots(ids: string[], days = 7, conn: DbOrTx = db, now = new Date()): Promise<Set<string>> {
  const result = new Set<string>();
  if (!ids.length) return result;
  const [inputs, durations] = await Promise.all([
    loadSlotInputs(ids, now, days, conn, now),
    conn
      .select({ consultantId: consultantServices.consultantId, d: sql<number>`min(${consultantServices.durationMinutes})::int` })
      .from(consultantServices)
      .where(and(inArray(consultantServices.consultantId, ids), eq(consultantServices.active, true), isNull(consultantServices.deletedAt)))
      .groupBy(consultantServices.consultantId),
  ]);
  for (const { consultantId, d } of durations) {
    const inp = inputs.get(consultantId);
    if (!inp || !inp.rules.length) continue;
    const slots = generateSlots({ ...inp, durationMinutes: d, from: now, days, now });
    if (slots.length) result.add(consultantId);
  }
  return result;
}

/** Next few open slots across a consultant's shortest service — for the profile preview. */
export async function getAvailabilityPreview(consultantId: string, limit = 6, conn: DbOrTx = db) {
  const [svc] = await conn
    .select({ id: consultantServices.id })
    .from(consultantServices)
    .where(and(eq(consultantServices.consultantId, consultantId), eq(consultantServices.active, true), isNull(consultantServices.deletedAt)))
    .orderBy(consultantServices.durationMinutes)
    .limit(1);
  if (!svc) return null;
  const now = new Date();
  const res = await getAvailableSlots(consultantId, svc.id, now, 21, { conn, now });
  return { ...res, serviceId: svc.id, slots: res.slots.slice(0, limit) };
}


/** Slots for a service looked up by id alone (the service determines the consultant). */
export async function getAvailableSlotsForService(serviceId: string, fromDate: Date, days: number) {
  const [svc] = await db.select({ consultantId: consultantServices.consultantId }).from(consultantServices).where(eq(consultantServices.id, serviceId)).limit(1);
  if (!svc) throw notFound("That service");
  return getAvailableSlots(svc.consultantId, serviceId, fromDate, days);
}
