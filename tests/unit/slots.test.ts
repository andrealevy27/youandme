import { describe, expect, it } from "vitest";
import { generateSlots, isSlotAvailable, type AvailabilityRule } from "../../src/server/consultants/slots";
import { addDays, getZonedParts, toLocalDate, weekdayOf, zonedTimeToUtc } from "../../src/server/consultants/tz";

const NY = "America/New_York";
const weekdays9to12: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 9 * 60, endMinute: 12 * 60 }));

const base = {
  rules: weekdays9to12,
  timeOff: [] as string[],
  busy: [],
  timezone: NY,
  durationMinutes: 60,
  minNoticeHours: 0,
};

describe("tz helpers", () => {
  it("converts wall time to UTC in standard and daylight time", () => {
    expect(zonedTimeToUtc("2026-01-15", 9 * 60, NY)!.toISOString()).toBe("2026-01-15T14:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-15", 9 * 60, NY)!.toISOString()).toBe("2026-07-15T13:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-15", 9 * 60, "Asia/Kolkata")!.toISOString()).toBe("2026-07-15T03:30:00.000Z");
  });

  it("returns null for wall times inside the spring-forward gap", () => {
    // 2026-03-08 02:30 does not exist in New York.
    expect(zonedTimeToUtc("2026-03-08", 2 * 60 + 30, NY)).toBeNull();
  });

  it("picks the earlier instant for ambiguous fall-back times", () => {
    // 2026-11-01 01:30 happens twice in New York; the first is EDT (UTC-4).
    expect(zonedTimeToUtc("2026-11-01", 90, NY)!.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("computes weekdays and adds days across month boundaries", () => {
    expect(weekdayOf("2026-09-24")).toBe(4); // Thursday
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(toLocalDate(new Date("2026-09-25T02:00:00Z"), NY)).toBe("2026-09-24");
    expect(getZonedParts(new Date("2026-09-25T02:00:00Z"), NY).hour).toBe(22);
  });
});

describe("generateSlots", () => {
  it("generates slots only on rule weekdays, in the consultant's timezone", () => {
    const now = new Date("2026-09-20T00:00:00Z"); // Saturday evening in NY
    const slots = generateSlots({ ...base, from: now, now, days: 7 });
    // Mon–Fri, 9:00–12:00 with 60-min sessions every 30 min → 9:00, 9:30, 10:00, 10:30, 11:00 = 5/day
    expect(slots).toHaveLength(25);
    expect(slots[0]!.startsAt.toISOString()).toBe("2026-09-21T13:00:00.000Z");
    expect(new Set(slots.map((s) => weekdayOf(s.localDate)))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("returns no slots when there are no rules (never fake availability)", () => {
    const now = new Date("2026-09-20T00:00:00Z");
    expect(generateSlots({ ...base, rules: [], from: now, now, days: 14 })).toEqual([]);
  });

  it("keeps the same wall-clock time across the DST change", () => {
    const now = new Date("2026-10-29T00:00:00Z");
    const slots = generateSlots({ ...base, from: now, now, days: 7 });
    const firstPerDay = new Map<string, Date>();
    for (const s of slots) if (!firstPerDay.has(s.localDate)) firstPerDay.set(s.localDate, s.startsAt);
    // Friday Oct 30 is EDT (UTC-4); Monday Nov 2 is EST (UTC-5). Both at 9:00 local.
    expect(firstPerDay.get("2026-10-30")!.toISOString()).toBe("2026-10-30T13:00:00.000Z");
    expect(firstPerDay.get("2026-11-02")!.toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });

  it("skips slots that fall in the spring-forward gap", () => {
    const rules = [{ weekday: 0, startMinute: 60, endMinute: 4 * 60 }]; // Sunday 01:00–04:00
    const now = new Date("2026-03-07T00:00:00Z");
    const slots = generateSlots({ ...base, rules, durationMinutes: 30, from: now, now, days: 3 });
    const local = slots.map((s) => {
      const p = getZonedParts(s.startsAt, NY);
      return `${p.hour}:${String(p.minute).padStart(2, "0")}`;
    });
    expect(local).not.toContain("2:00");
    expect(local).not.toContain("2:30");
    expect(local).toEqual(["1:00", "1:30", "3:00", "3:30"]);
  });

  it("enforces minimum notice", () => {
    const now = new Date("2026-09-21T12:00:00Z"); // Mon 08:00 NY
    const slots = generateSlots({ ...base, minNoticeHours: 24, from: now, now, days: 3 });
    expect(slots[0]!.startsAt.getTime()).toBeGreaterThanOrEqual(now.getTime() + 24 * 3600_000);
    expect(slots[0]!.startsAt.toISOString()).toBe("2026-09-22T13:00:00.000Z");
  });

  it("removes time off and overlapping bookings", () => {
    const now = new Date("2026-09-20T00:00:00Z");
    const busy = [{ startsAt: new Date("2026-09-22T14:00:00Z"), endsAt: new Date("2026-09-22T15:00:00Z") }]; // Tue 10–11 NY
    const slots = generateSlots({ ...base, timeOff: ["2026-09-21"], busy, from: now, now, days: 4 });
    expect(slots.some((s) => s.localDate === "2026-09-21")).toBe(false);
    const tue = slots.filter((s) => s.localDate === "2026-09-22").map((s) => s.startsAt.toISOString());
    // 9:30, 10:00, 10:30 overlap the 10–11 booking.
    expect(tue).toEqual(["2026-09-22T13:00:00.000Z", "2026-09-22T15:00:00.000Z"]);
  });

  it("validates a concrete start time", () => {
    const now = new Date("2026-09-20T00:00:00Z");
    expect(isSlotAvailable({ ...base, now }, new Date("2026-09-21T13:00:00Z"))).toBe(true);
    expect(isSlotAvailable({ ...base, now }, new Date("2026-09-21T13:15:00Z"))).toBe(false);
    expect(isSlotAvailable({ ...base, now }, new Date("2026-09-20T13:00:00Z"))).toBe(false); // Sunday
  });
});
