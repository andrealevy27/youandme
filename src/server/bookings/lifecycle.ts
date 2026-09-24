/**
 * Low-level booking transitions and their side effects (conversation, notifications,
 * analytics). Deliberately free of payment-provider imports so both the bookings and
 * payments services can use it without a cycle.
 */
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, type DbOrTx, type Tx } from "../db";
import { bookingParticipants, bookings, consultantProfiles, payments, profiles } from "../db/schema";
import { AppError, notFound } from "../errors";
import { addSystemMessage, createConversation, ensureDirectConversation } from "../messaging";
import { notify } from "../notifications";
import { logger } from "../logger";
import type { BookingStatus } from "@/lib/domain";
import { nextBookingStatus, PENDING_PAYMENT_TTL_MINUTES, type BookingEvent } from "./state";

export type BookingRow = typeof bookings.$inferSelect;

export async function lockBooking(tx: Tx, bookingId: string): Promise<BookingRow> {
  const [row] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update").limit(1);
  if (!row) throw notFound("That booking");
  return row;
}

/** Apply a state-machine event inside a transaction. Throws CONFLICT on an illegal transition. */
export async function applyBookingEvent(
  tx: Tx,
  booking: BookingRow,
  event: BookingEvent,
  patch: Partial<Pick<BookingRow, "cancelledAt" | "cancelledById" | "cancelReason" | "completedAt" | "conversationId">> = {},
): Promise<BookingRow> {
  const next = nextBookingStatus(booking.status, event);
  if (!next) throw new AppError("CONFLICT", `This booking is ${booking.status.replace("_", " ")} and can't be updated that way.`);
  const [updated] = await tx.update(bookings).set({ status: next, ...patch }).where(eq(bookings.id, booking.id)).returning();
  return updated!;
}

/** Cancel unpaid bookings whose slot hold has lapsed (for one consultant, or all). */
export async function expireStaleBookings(conn: DbOrTx = db, consultantId?: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - PENDING_PAYMENT_TTL_MINUTES * 60_000);
  await conn
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: now, cancelReason: "Payment wasn't completed in time." })
    .where(and(eq(bookings.status, "pending_payment"), lt(bookings.createdAt, cutoff), consultantId ? eq(bookings.consultantId, consultantId) : undefined));
  await conn.execute(sql`
    update ${payments} set status = 'cancelled', updated_at = now()
    where status = 'pending' and booking_id in (select id from ${bookings} where status = 'cancelled')`);
}

async function names(ids: string[], conn: DbOrTx = db) {
  if (!ids.length) return new Map<string, string>();
  const rows = await conn.select({ id: profiles.userId, name: profiles.displayName }).from(profiles).where(sql`${profiles.userId} in ${ids}`);
  return new Map(rows.map((r) => [r.id, r.name]));
}

export function formatSessionTime(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
}

export type ConfirmOutcome = { status: "confirmed"; booking: BookingRow } | { status: "already" } | { status: "needs_refund"; booking: BookingRow };

/**
 * Mark a checkout paid and confirm its booking. Idempotent: replays (webhook retries,
 * double submits) are no-ops. If the booking lapsed before payment arrived, the caller
 * must refund.
 */
export async function confirmPayment(opts: { paymentRowId: string; providerPaymentId: string | null; providerSubscriptionId: string | null }): Promise<ConfirmOutcome> {
  const outcome = await db.transaction(async (tx): Promise<ConfirmOutcome> => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, opts.paymentRowId)).for("update").limit(1);
    if (!payment) throw notFound("Payment");
    if (payment.status !== "pending" && payment.status !== "cancelled") return { status: "already" };
    const booking = await lockBooking(tx, payment.bookingId);
    await tx
      .update(payments)
      .set({
        status: "confirmed",
        providerPaymentId: opts.providerPaymentId ?? payment.providerPaymentId,
        providerSubscriptionId: opts.providerSubscriptionId ?? payment.providerSubscriptionId,
      })
      .where(eq(payments.id, payment.id));
    if (booking.status !== "pending_payment") return { status: "needs_refund", booking };
    const updated = await applyBookingEvent(tx, booking, "payment_confirmed");
    await tx
      .update(consultantProfiles)
      .set({ engagementCount: sql`${consultantProfiles.engagementCount} + 1` })
      .where(eq(consultantProfiles.userId, booking.consultantId));
    return { status: "confirmed", booking: updated };
  });
  if (outcome.status === "confirmed") {
    const [payment] = await db.select({ metadata: payments.metadata }).from(payments).where(eq(payments.id, opts.paymentRowId)).limit(1);
    await onBookingConfirmed(outcome.booking, payment?.metadata?.groupChat === "1").catch((err) => logger.error("booking_confirm_side_effects_failed", { err, bookingId: outcome.booking.id }));
  }
  return outcome;
}

/** Conversation + notifications after confirmation. */
async function onBookingConfirmed(booking: BookingRow, groupChat: boolean) {
  const participants = await db.select().from(bookingParticipants).where(eq(bookingParticipants.bookingId, booking.id));
  const teammates = participants.filter((p) => p.role === "teammate").map((p) => p.userId);
  const nameOf = await names([booking.clientId, booking.consultantId, ...teammates]);
  const consultantName = nameOf.get(booking.consultantId) ?? "your consultant";
  const clientName = nameOf.get(booking.clientId) ?? "A client";
  const when = formatSessionTime(booking.startsAt, booking.timezone);

  let conversationId: string;
  if (groupChat && teammates.length) {
    const convo = await createConversation({
      type: "booking",
      memberIds: [booking.clientId, booking.consultantId, ...teammates],
      createdById: booking.clientId,
      title: `${booking.serviceTitle} · ${consultantName}`,
      bookingId: booking.id,
      startupId: booking.startupId,
    });
    conversationId = convo.id;
  } else {
    const convo = await ensureDirectConversation(booking.clientId, booking.consultantId, "consultant");
    conversationId = convo.id;
  }
  await addSystemMessage(conversationId, `Booking confirmed: ${booking.serviceTitle} — ${when}.`);
  await db.update(bookings).set({ conversationId }).where(eq(bookings.id, booking.id));

  const href = `/bookings/${booking.id}`;
  await notify({ userId: booking.consultantId, type: "booking", title: `New booking from ${clientName}`, body: `${booking.serviceTitle} — ${when}`, href, actorId: booking.clientId });
  await notify({ userId: booking.clientId, type: "booking", title: `Booking confirmed with ${consultantName}`, body: `${booking.serviceTitle} — ${when}`, href });
  for (const t of teammates) {
    await notify({ userId: t, type: "booking", title: `${clientName} added you to a session with ${consultantName}`, body: `${booking.serviceTitle} — ${when}`, href, actorId: booking.clientId });
  }
}

/** Mark the latest payment of a booking with a new status (used by refunds/disputes). */
export async function setLatestPaymentStatus(conn: DbOrTx, bookingId: string, status: (typeof payments.$inferSelect)["status"], failureReason?: string) {
  const [latest] = await conn.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt)).limit(1);
  if (!latest) return null;
  await conn.update(payments).set({ status, ...(failureReason ? { failureReason } : {}) }).where(eq(payments.id, latest.id));
  return latest;
}

export async function notifyAll(booking: BookingRow, input: { title: string; body?: string; actorId?: string | null; exclude?: string[] }) {
  const participants = await db.select({ userId: bookingParticipants.userId }).from(bookingParticipants).where(eq(bookingParticipants.bookingId, booking.id));
  const ids = new Set([booking.clientId, booking.consultantId, ...participants.map((p) => p.userId)]);
  for (const id of ids) {
    if (input.exclude?.includes(id)) continue;
    await notify({ userId: id, type: "booking", title: input.title, body: input.body, href: `/bookings/${booking.id}`, actorId: input.actorId ?? null });
  }
}

export function isPaidStatus(s: BookingStatus) {
  return s === "confirmed" || s === "completed" || s === "disputed";
}

