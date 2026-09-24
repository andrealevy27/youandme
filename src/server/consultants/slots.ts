/**
 * Pure slot generation. Availability is ONLY ever derived from the consultant's
 * real weekly rules — no rules means no slots.
 */
import { addDays, toLocalDate, weekdayOf, zonedTimeToUtc, type LocalDate } from "./tz";

export type AvailabilityRule = { weekday: number; startMinute: number; endMinute: number };
export type BusyInterval = { startsAt: Date; endsAt: Date };
export type Slot = { startsAt: Date; endsAt: Date; localDate: LocalDate };

export type GenerateSlotsInput = {
  rules: AvailabilityRule[];
  /** Consultant-local dates the consultant is off. */
  timeOff: Iterable<LocalDate>;
  busy: BusyInterval[];
  timezone: string;
  durationMinutes: number;
  /** First consultant-local date to consider is the local date containing this instant. */
  from: Date;
  days: number;
  now: Date;
  minNoticeHours: number;
  /** Start-time granularity; defaults to 30 minutes (or the duration if shorter). */
  stepMinutes?: number;
  /** Buffer kept free around existing bookings. */
  bufferMinutes?: number;
};

export const MAX_SLOT_DAYS = 62;

export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const { rules, timezone, durationMinutes, now } = input;
  if (!rules.length || durationMinutes <= 0) return [];
  const days = Math.max(0, Math.min(MAX_SLOT_DAYS, Math.floor(input.days)));
  const step = Math.max(5, input.stepMinutes ?? Math.min(30, durationMinutes));
  const buffer = Math.max(0, input.bufferMinutes ?? 0) * 60_000;
  const off = new Set(input.timeOff);
  const earliest = now.getTime() + input.minNoticeHours * 3_600_000;
  const busy = input.busy.map((b) => ({ s: b.startsAt.getTime() - buffer, e: b.endsAt.getTime() + buffer }));
  const durMs = durationMinutes * 60_000;

  const out: Slot[] = [];
  const seen = new Set<number>();
  let day = toLocalDate(input.from, timezone);
  for (let i = 0; i < days; i++, day = addDays(day, 1)) {
    if (off.has(day)) continue;
    const wd = weekdayOf(day);
    const dayRules = rules.filter((r) => r.weekday === wd && r.endMinute > r.startMinute).sort((a, b) => a.startMinute - b.startMinute);
    for (const rule of dayRules) {
      for (let m = rule.startMinute; m + durationMinutes <= rule.endMinute; m += step) {
        const start = zonedTimeToUtc(day, m, timezone);
        if (!start) continue; // wall time skipped by a DST transition
        const s = start.getTime();
        const e = s + durMs;
        if (s < earliest || seen.has(s)) continue;
        if (busy.some((b) => s < b.e && e > b.s)) continue;
        seen.add(s);
        out.push({ startsAt: start, endsAt: new Date(e), localDate: day });
      }
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Is a concrete start time one of the generated slots? Used to validate bookings server-side. */
export function isSlotAvailable(input: Omit<GenerateSlotsInput, "from" | "days">, startsAt: Date): boolean {
  // Generate across the consultant-local day of the requested start (±1 day covers tz edges).
  const slots = generateSlots({ ...input, from: new Date(startsAt.getTime() - 86_400_000), days: 3 });
  return slots.some((s) => s.startsAt.getTime() === startsAt.getTime());
}
