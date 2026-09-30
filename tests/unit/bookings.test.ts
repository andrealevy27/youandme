import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES } from "../../src/lib/domain";
import { BOOKING_EVENTS, checkCancellation, nextBookingStatus } from "../../src/server/bookings/state";
import { buildBookingIcs, escapeIcsText } from "../../src/server/bookings/ics";

describe("nextBookingStatus", () => {
  it("follows the happy path", () => {
    expect(nextBookingStatus("pending_payment", "payment_confirmed")).toBe("confirmed");
    expect(nextBookingStatus("confirmed", "complete")).toBe("completed");
  });

  it("handles cancellation, expiry, disputes and refunds", () => {
    expect(nextBookingStatus("pending_payment", "cancel")).toBe("cancelled");
    expect(nextBookingStatus("pending_payment", "expire")).toBe("cancelled");
    expect(nextBookingStatus("confirmed", "cancel")).toBe("cancelled");
    expect(nextBookingStatus("cancelled", "refund")).toBe("refunded");
    expect(nextBookingStatus("completed", "dispute")).toBe("disputed");
    expect(nextBookingStatus("disputed", "refund")).toBe("refunded");
    expect(nextBookingStatus("disputed", "resolve_dispute")).toBe("completed");
  });

  it("rejects illegal transitions", () => {
    expect(nextBookingStatus("pending_payment", "complete")).toBeNull();
    expect(nextBookingStatus("pending_payment", "refund")).toBeNull();
    expect(nextBookingStatus("completed", "cancel")).toBeNull();
    expect(nextBookingStatus("cancelled", "payment_confirmed")).toBeNull();
    expect(nextBookingStatus("confirmed", "payment_confirmed")).toBeNull();
  });

  it("treats refunded as terminal", () => {
    for (const e of BOOKING_EVENTS) expect(nextBookingStatus("refunded", e)).toBeNull();
  });

  it("is total over statuses × events", () => {
    for (const s of BOOKING_STATUSES) for (const e of BOOKING_EVENTS) {
      const next = nextBookingStatus(s, e);
      expect(next === null || (BOOKING_STATUSES as readonly string[]).includes(next)).toBe(true);
    }
  });
});

describe("checkCancellation", () => {
  const startsAt = new Date("2026-10-01T15:00:00Z");
  it("lets clients cancel unpaid bookings any time before start", () => {
    expect(checkCancellation({ status: "pending_payment", role: "client", startsAt, now: new Date("2026-10-01T14:00:00Z") }).ok).toBe(true);
  });
  it("requires 24h notice for clients on confirmed bookings", () => {
    expect(checkCancellation({ status: "confirmed", role: "client", startsAt, now: new Date("2026-09-30T14:59:00Z") }).ok).toBe(true);
    expect(checkCancellation({ status: "confirmed", role: "client", startsAt, now: new Date("2026-09-30T16:00:00Z") }).ok).toBe(false);
  });
  it("lets consultants cancel any time before start, never after", () => {
    expect(checkCancellation({ status: "confirmed", role: "consultant", startsAt, now: new Date("2026-10-01T14:30:00Z") }).ok).toBe(true);
    expect(checkCancellation({ status: "confirmed", role: "consultant", startsAt, now: new Date("2026-10-01T15:30:00Z") }).ok).toBe(false);
  });
  it("never cancels completed bookings", () => {
    expect(checkCancellation({ status: "completed", role: "consultant", startsAt, now: new Date("2026-09-01T00:00:00Z") }).ok).toBe(false);
  });
});

describe("ics", () => {
  it("escapes text and emits a valid event", () => {
    expect(escapeIcsText("a,b;c\nd\\e")).toBe("a\\,b\;c\\nd\\\\e");
    const ics = buildBookingIcs({
      uid: "abc",
      title: "Growth Strategy Session",
      description: "With Maya",
      startsAt: new Date("2026-10-01T15:00:00Z"),
      endsAt: new Date("2026-10-01T16:30:00Z"),
      url: "https://youandme.company/bookings/abc",
      organizerName: "Maya",
      now: new Date("2026-09-24T00:00:00Z"),
    });
    expect(ics).toContain("DTSTART:20261001T150000Z");
    expect(ics).toContain("DTEND:20261001T163000Z");
    expect(ics).toContain("UID:abc@youandme.company");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
