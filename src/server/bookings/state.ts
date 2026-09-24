import type { BookingStatus } from "@/lib/domain";

/**
 * Booking lifecycle — the single source of truth for which transitions are legal.
 *
 *   pending_payment ──payment_confirmed──▶ confirmed ──complete──▶ completed
 *        │  cancel / expire                  │ cancel                 │ dispute / refund
 *        ▼                                   ▼                        ▼
 *     cancelled ◀────────────────────── cancelled ──refund──▶ refunded ◀── disputed
 */
export const BOOKING_EVENTS = [
  "payment_confirmed",
  "cancel",
  "expire",
  "complete",
  "dispute",
  "refund",
  "resolve_dispute",
] as const;
export type BookingEvent = (typeof BOOKING_EVENTS)[number];

const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingEvent, BookingStatus>>> = {
  pending_payment: { payment_confirmed: "confirmed", cancel: "cancelled", expire: "cancelled" },
  confirmed: { cancel: "cancelled", complete: "completed", dispute: "disputed", refund: "refunded" },
  completed: { dispute: "disputed", refund: "refunded" },
  // A paid booking that was cancelled can still be refunded (e.g. async provider refund).
  cancelled: { refund: "refunded" },
  disputed: { refund: "refunded", resolve_dispute: "completed" },
  refunded: {},
};

/** Pure transition function: returns the next status, or null when the event is not allowed. */
export function nextBookingStatus(current: BookingStatus, event: BookingEvent): BookingStatus | null {
  return TRANSITIONS[current]?.[event] ?? null;
}

export function canTransition(current: BookingStatus, event: BookingEvent): boolean {
  return nextBookingStatus(current, event) !== null;
}

/** Statuses that hold a slot on the consultant's calendar. */
export const LIVE_BOOKING_STATUSES = ["pending_payment", "confirmed"] as const satisfies readonly BookingStatus[];

/** Unpaid bookings stop holding the slot after this long. */
export const PENDING_PAYMENT_TTL_MINUTES = 35;

/** Clients may cancel a confirmed booking (with a full refund) up to this many hours before it starts. */
export const CLIENT_CANCEL_CUTOFF_HOURS = 24;

/** Clients may open a dispute up to this many days after a session ended. */
export const DISPUTE_WINDOW_DAYS = 14;

export type CancelCheck = { ok: true } | { ok: false; reason: string };

/** Pure cancellation policy (who can cancel what, when). */
export function checkCancellation(opts: {
  status: BookingStatus;
  role: "client" | "consultant";
  startsAt: Date;
  now: Date;
}): CancelCheck {
  const { status, role, startsAt, now } = opts;
  if (!canTransition(status, "cancel")) return { ok: false, reason: "This booking can no longer be cancelled." };
  if (status === "pending_payment") return { ok: true };
  if (now >= startsAt) return { ok: false, reason: "This session has already started. Open a dispute if something went wrong." };
  if (role === "client" && startsAt.getTime() - now.getTime() < CLIENT_CANCEL_CUTOFF_HOURS * 3_600_000) {
    return {
      ok: false,
      reason: `Bookings can be cancelled up to ${CLIENT_CANCEL_CUTOFF_HOURS} hours before they start. Message the consultant to reschedule.`,
    };
  }
  return { ok: true };
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  disputed: "In dispute",
};
