import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  bookingParticipants,
  bookings,
  consultantProfiles,
  consultantServices,
  conversationMembers,
  payments,
  profiles,
  reviews,
  startupMembers,
  startups,
} from "../db/schema";
import { AppError, forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { track } from "../analytics";
import { enforceRateLimit } from "../rate-limit";
import { getSetting } from "../settings";
import { notify } from "../notifications";
import { addSystemMessage } from "../messaging";
import { isBlockedEitherWay } from "../privacy/visibility";
import { canOnStartup } from "../authz/startup";
import { hasAdminPermission } from "../authz/admin";
import { loadSlotInputs } from "../consultants/availability";
import { isSlotAvailable } from "../consultants/slots";
import { isValidTimeZone } from "../consultants/tz";
import { bookingAmount, computePlatformFee } from "../payments/fees";
import { paymentAvailability } from "../payments/availability";
import { refundLatestPayment } from "../payments";
import type { AdminRole, BookingStatus } from "@/lib/domain";
import { applyBookingEvent, expireStaleBookings, formatSessionTime, isPaidStatus, lockBooking, notifyAll, setLatestPaymentStatus, type BookingRow } from "./lifecycle";
import { checkCancellation, canTransition, DISPUTE_WINDOW_DAYS, PENDING_PAYMENT_TTL_MINUTES } from "./state";
import { buildBookingIcs } from "./ics";

export { nextBookingStatus, BOOKING_STATUS_LABELS, checkCancellation } from "./state";
export type { BookingRow } from "./lifecycle";

export const createBookingInput = z.object({
  serviceId: z.string().uuid(),
  startsAt: z.coerce.date(),
  projectContext: z.string().trim().max(4000).optional().transform((v) => v || null),
  startupId: z.string().uuid().nullish(),
  teammateIds: z.array(z.string().uuid()).max(10).default([]),
  timezone: z.string().max(64).optional(),
});

/**
 * Create a booking in `pending_payment`. Validates the slot is genuinely free
 * (serialised per consultant with an advisory lock + the partial unique index),
 * snapshots price, computes the platform fee and records participants.
 */
export async function createBooking(viewerId: string, raw: z.input<typeof createBookingInput>): Promise<BookingRow> {
  const input = createBookingInput.parse(raw);
  enforceRateLimit("booking", viewerId);

  const [row] = await db
    .select({ s: consultantServices, c: consultantProfiles, p: profiles })
    .from(consultantServices)
    .innerJoin(consultantProfiles, eq(consultantProfiles.userId, consultantServices.consultantId))
    .innerJoin(profiles, eq(profiles.userId, consultantServices.consultantId))
    .where(and(eq(consultantServices.id, input.serviceId), eq(consultantServices.active, true), isNull(consultantServices.deletedAt)))
    .limit(1);
  if (!row) throw notFound("That service");
  const { s: service, c: consultant, p: consultantProfile } = row;
  if (consultant.userId === viewerId) throw new AppError("VALIDATION", "You can't book your own services.");
  if (consultant.status !== "approved" || consultantProfile.status !== "active" || consultantProfile.deletedAt) {
    throw new AppError("UNAVAILABLE", "This consultant isn't taking bookings right now.");
  }
  if (!consultant.acceptingClients) throw new AppError("UNAVAILABLE", "This consultant isn't taking new clients right now.");
  if (await isBlockedEitherWay(viewerId, consultant.userId)) throw forbidden("You can't book this consultant.");
  const pay = paymentAvailability({ stripeAccountId: consultant.stripeAccountId, stripeChargesEnabled: consultant.stripeChargesEnabled });
  if (!pay.payable) throw new AppError("UNAVAILABLE", pay.reason);

  // Startup + teammates: the booker must be allowed to manage the startup's bookings,
  // and every teammate must be a current member of that startup.
  const teammateIds = [...new Set(input.teammateIds)].filter((id) => id !== viewerId && id !== consultant.userId);
  if (teammateIds.length && !input.startupId) throw new AppError("VALIDATION", "Choose which startup this booking is for before adding teammates.");
  if (input.startupId) {
    const [membership] = await db
      .select({ role: startupMembers.role, isAdmin: startupMembers.isAdmin })
      .from(startupMembers)
      .innerJoin(startups, eq(startups.id, startupMembers.startupId))
      .where(and(eq(startupMembers.startupId, input.startupId), eq(startupMembers.userId, viewerId), isNull(startupMembers.removedAt), isNull(startups.deletedAt)))
      .limit(1);
    if (!canOnStartup(membership ?? null, "manage_bookings")) throw forbidden("You don't have permission to book on behalf of this startup.");
    if (teammateIds.length) {
      const members = await db
        .select({ userId: startupMembers.userId })
        .from(startupMembers)
        .where(and(eq(startupMembers.startupId, input.startupId), inArray(startupMembers.userId, teammateIds), isNull(startupMembers.removedAt)));
      if (members.length !== teammateIds.length) throw new AppError("VALIDATION", "Teammates must be current members of your startup.");
    }
  }

  const tz = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : consultant.timezone;
  const amountCents = bookingAmount(service.pricingType, service.priceCents, 1);
  const feeBps = await getSetting("platform_fee_bps");
  const platformFeeCents = computePlatformFee(amountCents, feeBps);
  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  const booking = await db.transaction(async (tx) => {
    // Serialise bookings per consultant so two clients can't grab the same slot.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"booking:" + consultant.userId}))`);
    await expireStaleBookings(tx, consultant.userId);
    const now = new Date();
    const inputs = (await loadSlotInputs([consultant.userId], startsAt, 1, tx, now)).get(consultant.userId);
    const free =
      !!inputs && isSlotAvailable({ ...inputs, durationMinutes: service.durationMinutes, now }, startsAt);
    if (!free) throw new AppError("CONFLICT", "That time was just taken or is no longer available. Please pick another slot.");

    const [created] = await tx
      .insert(bookings)
      .values({
        serviceId: service.id,
        consultantId: consultant.userId,
        clientId: viewerId,
        startupId: input.startupId ?? null,
        status: "pending_payment",
        serviceTitle: service.title,
        pricingType: service.pricingType,
        quantity: 1,
        amountCents,
        platformFeeCents,
        currency: service.currency,
        startsAt,
        endsAt,
        timezone: tz,
        projectContext: input.projectContext,
      })
      .returning();
    await tx.insert(bookingParticipants).values([
      { bookingId: created!.id, userId: viewerId, role: "client" },
      { bookingId: created!.id, userId: consultant.userId, role: "consultant" },
      ...teammateIds.map((userId) => ({ bookingId: created!.id, userId, role: "teammate" })),
    ]);
    return created!;
  }).catch((err: unknown) => {
    // Unique index violation = someone else won the race.
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      throw new AppError("CONFLICT", "That time was just taken. Please pick another slot.");
    }
    throw err;
  });

  track("booking_started", viewerId, { consultantId: consultant.userId, serviceId: service.id, pricingType: service.pricingType, teammates: teammateIds.length });
  return booking;
}

// ── Reads ──────────────────────────────────────────────────────────────────

export const BOOKING_TABS = ["upcoming", "past", "cancelled"] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

export type BookingListItem = {
  id: string;
  status: BookingStatus;
  serviceTitle: string;
  pricingType: BookingRow["pricingType"];
  amountCents: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  role: "client" | "consultant" | "teammate";
  counterpart: { userId: string; name: string; handle: string; avatarUrl: string | null; isDemo: boolean };
  hasReview: boolean;
};

/** Bookings the viewer takes part in (as client, consultant or teammate). */
export async function listBookingsForUser(viewerId: string, tab: BookingTab = "upcoming", opts: { limit?: number; role?: "client" | "consultant" } = {}): Promise<BookingListItem[]> {
  await expireStaleBookings(db);
  const now = new Date();
  const limit = Math.min(opts.limit ?? 50, 100);
  const tabCond =
    tab === "cancelled"
      ? inArray(bookings.status, ["cancelled", "refunded"])
      : tab === "upcoming"
        ? and(inArray(bookings.status, ["pending_payment", "confirmed", "disputed"]), gte(bookings.endsAt, now))
        : or(
            inArray(bookings.status, ["completed"]),
            and(inArray(bookings.status, ["confirmed", "disputed"]), lt(bookings.endsAt, now)),
          );
  const rows = await db
    .select({ b: bookings, role: bookingParticipants.role })
    .from(bookingParticipants)
    .innerJoin(bookings, eq(bookings.id, bookingParticipants.bookingId))
    .where(and(eq(bookingParticipants.userId, viewerId), tabCond, opts.role ? eq(bookingParticipants.role, opts.role) : undefined))
    .orderBy(tab === "upcoming" ? asc(bookings.startsAt) : desc(bookings.startsAt))
    .limit(limit);
  if (!rows.length) return [];
  const counterpartIds = rows.map((r) => (r.role === "consultant" ? r.b.clientId : r.b.consultantId));
  const [people, reviewRows] = await Promise.all([
    db.select().from(profiles).where(inArray(profiles.userId, [...new Set(counterpartIds)])),
    db.select({ bookingId: reviews.bookingId }).from(reviews).where(inArray(reviews.bookingId, rows.map((r) => r.b.id))),
  ]);
  return rows.map((r, i) => {
    const p = people.find((x) => x.userId === counterpartIds[i]);
    return {
      id: r.b.id,
      status: r.b.status,
      serviceTitle: r.b.serviceTitle,
      pricingType: r.b.pricingType,
      amountCents: r.b.amountCents,
      currency: r.b.currency,
      startsAt: r.b.startsAt,
      endsAt: r.b.endsAt,
      role: r.role as BookingListItem["role"],
      counterpart: { userId: counterpartIds[i]!, name: p?.displayName ?? "Former member", handle: p?.handle ?? "", avatarUrl: p?.avatarUrl ?? null, isDemo: p?.isDemo ?? false },
      hasReview: reviewRows.some((x) => x.bookingId === r.b.id),
    };
  });
}

export type BookingDetail = Awaited<ReturnType<typeof getBookingForViewer>>;

/** Full booking view with the actions the viewer may take. Participants only. */
export async function getBookingForViewer(viewerId: string, bookingId: string, opts: { adminRole?: AdminRole | null } = {}) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw notFound("That booking");
  const participants = await db
    .select({ userId: bookingParticipants.userId, role: bookingParticipants.role, name: profiles.displayName, handle: profiles.handle, avatarUrl: profiles.avatarUrl, isDemo: profiles.isDemo })
    .from(bookingParticipants)
    .innerJoin(profiles, eq(profiles.userId, bookingParticipants.userId))
    .where(eq(bookingParticipants.bookingId, bookingId));
  const me = participants.find((p) => p.userId === viewerId);
  const isAdmin = hasAdminPermission(opts.adminRole ?? null, "bookings.read");
  if (!me && !isAdmin) throw notFound("That booking");

  const [paymentRows, review, startup, convoMember] = await Promise.all([
    db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt)),
    db.select().from(reviews).where(eq(reviews.bookingId, bookingId)).limit(1),
    booking.startupId ? db.select({ name: startups.name, slug: startups.slug }).from(startups).where(eq(startups.id, booking.startupId)).limit(1) : Promise.resolve([]),
    booking.conversationId
      ? db
          .select({ id: conversationMembers.conversationId })
          .from(conversationMembers)
          .where(and(eq(conversationMembers.conversationId, booking.conversationId), eq(conversationMembers.userId, viewerId), isNull(conversationMembers.leftAt)))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const [[consultant], [service]] = await Promise.all([
    db
      .select({ stripeAccountId: consultantProfiles.stripeAccountId, stripeChargesEnabled: consultantProfiles.stripeChargesEnabled })
      .from(consultantProfiles)
      .where(eq(consultantProfiles.userId, booking.consultantId))
      .limit(1),
    db.select({ billingInterval: consultantServices.billingInterval }).from(consultantServices).where(eq(consultantServices.id, booking.serviceId)).limit(1),
  ]);
  const now = new Date();
  const role = me?.role as "client" | "consultant" | "teammate" | undefined;
  const holdExpired = booking.status === "pending_payment" && now.getTime() - booking.createdAt.getTime() > PENDING_PAYMENT_TTL_MINUTES * 60_000;
  const cancelCheck = role === "client" || role === "consultant" ? checkCancellation({ status: booking.status, role, startsAt: booking.startsAt, now }) : { ok: false as const, reason: "" };
  const latestPayment = paymentRows[0] ?? null;

  return {
    booking,
    participants,
    viewerRole: role ?? null,
    startup: startup[0] ?? null,
    payment: latestPayment
      ? { provider: latestPayment.provider, status: latestPayment.status, amountCents: latestPayment.amountCents, applicationFeeCents: latestPayment.applicationFeeCents, currency: latestPayment.currency, createdAt: latestPayment.createdAt }
      : null,
    paymentHistory: paymentRows.map((p) => ({ status: p.status, provider: p.provider, createdAt: p.createdAt, updatedAt: p.updatedAt })),
    review: review[0] ?? null,
    payable: consultant ? paymentAvailability(consultant) : null,
    can: {
      pay: role === "client" && booking.status === "pending_payment" && !holdExpired,
      cancel: cancelCheck.ok,
      cancelBlockedReason: cancelCheck.ok ? null : cancelCheck.reason,
      complete: role === "consultant" && canTransition(booking.status, "complete") && booking.endsAt <= now,
      review: role === "client" && booking.status === "completed" && !review[0],
      dispute:
        role === "client" &&
        canTransition(booking.status, "dispute") &&
        booking.startsAt <= now &&
        now.getTime() - booking.endsAt.getTime() < DISPUTE_WINDOW_DAYS * 86_400_000,
      refund: (role === "consultant" || hasAdminPermission(opts.adminRole ?? null, "payments.refund")) && canTransition(booking.status, "refund") && isPaidStatus(booking.status),
      downloadIcs: booking.status === "confirmed" || booking.status === "completed",
    },
    holdExpired,
    conversationId: convoMember[0]?.id ?? null,
    billingInterval: booking.pricingType === "recurring" ? (service?.billingInterval ?? "month") : null,
  };
}

// ── Mutations ──────────────────────────────────────────────────────────────

export const cancelBookingInput = z.object({ bookingId: z.string().uuid(), reason: z.string().trim().max(1000).optional() });

/** Cancel (client or consultant). Paid bookings are refunded in full. */
export async function cancelBooking(viewerId: string, raw: z.input<typeof cancelBookingInput>) {
  const { bookingId, reason } = cancelBookingInput.parse(raw);
  const { booking, wasPaid } = await db.transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    const role = b.clientId === viewerId ? "client" : b.consultantId === viewerId ? "consultant" : null;
    if (!role) throw notFound("That booking");
    const check = checkCancellation({ status: b.status, role, startsAt: b.startsAt, now: new Date() });
    if (!check.ok) throw new AppError("CONFLICT", check.reason);
    const wasPaid = b.status === "confirmed";
    const updated = await applyBookingEvent(tx, b, "cancel", { cancelledAt: new Date(), cancelledById: viewerId, cancelReason: reason ?? null });
    if (!wasPaid) await tx.update(payments).set({ status: "cancelled" }).where(and(eq(payments.bookingId, b.id), eq(payments.status, "pending")));
    return { booking: updated, wasPaid };
  });

  let final = booking;
  if (wasPaid) {
    const refund = await refundLatestPayment(booking.id);
    if (refund.refunded) {
      final = await db.transaction(async (tx) => applyBookingEvent(tx, await lockBooking(tx, booking.id), "refund"));
    }
  }
  await audit({ actorId: viewerId, action: "booking.cancelled", targetType: "booking", targetId: booking.id, metadata: { reason: reason ?? null, refunded: final.status === "refunded" } });
  if (booking.conversationId) {
    await addSystemMessage(booking.conversationId, `Booking cancelled: ${booking.serviceTitle}.`).catch(() => undefined);
  }
  // Unpaid bookings were never announced to the consultant, so only paid cancellations notify.
  if (wasPaid) await notifyAll(booking, {
    title: `Booking cancelled: ${booking.serviceTitle}`,
    body: `${formatSessionTime(booking.startsAt, booking.timezone)}${wasPaid ? " · A full refund has been issued." : ""}${reason ? ` · “${reason.slice(0, 120)}”` : ""}`,
    actorId: viewerId,
    exclude: [viewerId],
  });
  return final;
}

/** Consultant marks a session complete after it has ended. Asks the client for a review. */
export async function completeBooking(viewerId: string, bookingId: string) {
  const booking = await db.transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.consultantId !== viewerId) throw forbidden("Only the consultant can mark a session complete.");
    if (b.endsAt > new Date()) throw new AppError("CONFLICT", "You can mark this complete once the session has ended.");
    const updated = await applyBookingEvent(tx, b, "complete", { completedAt: new Date() });
    await setLatestPaymentStatus(tx, b.id, "completed");
    return updated;
  });
  const [consultant] = await db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.userId, booking.consultantId)).limit(1);
  await notify({
    userId: booking.clientId,
    type: "review_request",
    title: `How was your session with ${consultant?.name ?? "your consultant"}?`,
    body: `Leave a quick review of “${booking.serviceTitle}” — it helps other founders.`,
    href: `/bookings/${booking.id}#review`,
    actorId: viewerId,
  });
  track("booking_completed", viewerId, { bookingId: booking.id, pricingType: booking.pricingType });
  return booking;
}

export const disputeBookingInput = z.object({ bookingId: z.string().uuid(), reason: z.string().trim().min(10, "Tell us what went wrong (at least 10 characters).").max(2000) });

/** Client opens a dispute; the support team resolves it from the admin panel. */
export async function disputeBooking(viewerId: string, raw: z.input<typeof disputeBookingInput>) {
  const { bookingId, reason } = disputeBookingInput.parse(raw);
  const booking = await db.transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.clientId !== viewerId) throw forbidden("Only the client can open a dispute.");
    const now = new Date();
    if (b.startsAt > now) throw new AppError("CONFLICT", "You can cancel an upcoming booking instead of disputing it.");
    if (now.getTime() - b.endsAt.getTime() > DISPUTE_WINDOW_DAYS * 86_400_000) throw new AppError("CONFLICT", `Disputes can be opened up to ${DISPUTE_WINDOW_DAYS} days after a session.`);
    const updated = await applyBookingEvent(tx, b, "dispute");
    await setLatestPaymentStatus(tx, b.id, "disputed", reason);
    return updated;
  });
  await audit({ actorId: viewerId, action: "booking.disputed", targetType: "booking", targetId: booking.id, metadata: { reason } });
  await notifyAll(booking, { title: `A dispute was opened for ${booking.serviceTitle}`, body: "The You&Me team will review it and follow up.", actorId: viewerId, exclude: [viewerId] });
  return booking;
}

export const refundBookingInput = z.object({ bookingId: z.string().uuid(), reason: z.string().trim().max(1000).optional() });

/** Full refund: by the consultant (goodwill) or an admin with `payments.refund`. */
export async function refundBooking(actor: { userId: string; adminRole?: AdminRole | null }, raw: z.input<typeof refundBookingInput>) {
  const { bookingId, reason } = refundBookingInput.parse(raw);
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!b) throw notFound("That booking");
  const isAdmin = hasAdminPermission(actor.adminRole ?? null, "payments.refund");
  if (b.consultantId !== actor.userId && !isAdmin) throw forbidden();
  if (!canTransition(b.status, "refund")) throw new AppError("CONFLICT", "This booking can't be refunded.");
  const result = await refundLatestPayment(b.id);
  if (!result.refunded) throw new AppError("CONFLICT", "There's no completed payment to refund on this booking.");
  const updated = await db.transaction(async (tx) => {
    const locked = await lockBooking(tx, b.id);
    return locked.status === "refunded" ? locked : applyBookingEvent(tx, locked, "refund");
  });
  await audit({ actorId: actor.userId, action: "booking.refunded", targetType: "booking", targetId: b.id, metadata: { reason: reason ?? null, byAdmin: isAdmin && b.consultantId !== actor.userId, amountCents: b.amountCents } });
  await notifyAll(updated, { title: `Refund issued: ${b.serviceTitle}`, body: reason ?? undefined, actorId: actor.userId, exclude: [actor.userId] });
  return updated;
}

// ── Booking form context ───────────────────────────────────────────────────

/** Startups the viewer can book for, with their teammates (for the booking stepper). */
export async function getBookingStartupOptions(viewerId: string) {
  const memberships = await db
    .select({ startupId: startups.id, name: startups.name, role: startupMembers.role, isAdmin: startupMembers.isAdmin })
    .from(startupMembers)
    .innerJoin(startups, eq(startups.id, startupMembers.startupId))
    .where(and(eq(startupMembers.userId, viewerId), isNull(startupMembers.removedAt), isNull(startups.deletedAt)));
  const allowed = memberships.filter((m) => canOnStartup({ role: m.role, isAdmin: m.isAdmin }, "manage_bookings"));
  if (!allowed.length) return [];
  const teammates = await db
    .select({ startupId: startupMembers.startupId, userId: profiles.userId, name: profiles.displayName, avatarUrl: profiles.avatarUrl, role: startupMembers.role, title: startupMembers.title })
    .from(startupMembers)
    .innerJoin(profiles, eq(profiles.userId, startupMembers.userId))
    .where(and(inArray(startupMembers.startupId, allowed.map((a) => a.startupId)), isNull(startupMembers.removedAt), isNull(profiles.deletedAt)));
  return allowed.map((s) => ({
    id: s.startupId,
    name: s.name,
    teammates: teammates.filter((t) => t.startupId === s.startupId && t.userId !== viewerId).map(({ startupId: _s, ...t }) => t),
  }));
}

/** Summary counts for the consultant workspace. */
export async function getConsultantBookingSummary(consultantId: string) {
  const [row] = await db
    .select({
      upcoming: sql<number>`count(*) filter (where ${bookings.status} = 'confirmed' and ${bookings.endsAt} >= now())::int`,
      toComplete: sql<number>`count(*) filter (where ${bookings.status} = 'confirmed' and ${bookings.endsAt} < now())::int`,
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')::int`,
      earnedCents: sql<number>`coalesce(sum(${bookings.amountCents} - ${bookings.platformFeeCents}) filter (where ${bookings.status} = 'completed'), 0)::int`,
    })
    .from(bookings)
    .where(eq(bookings.consultantId, consultantId));
  return row ?? { upcoming: 0, toComplete: 0, completed: 0, earnedCents: 0 };
}

/** Real .ics for a confirmed/completed booking the viewer takes part in. */
export async function getBookingIcs(viewerId: string, bookingId: string, appUrl: string) {
  const detail = await getBookingForViewer(viewerId, bookingId);
  if (!detail.can.downloadIcs) throw new AppError("CONFLICT", "A calendar file is available once the booking is confirmed.");
  const b = detail.booking;
  const consultant = detail.participants.find((p) => p.role === "consultant");
  const others = detail.participants.filter((p) => p.userId !== viewerId).map((p) => p.name);
  const url = `${appUrl.replace(/\/$/, "")}/bookings/${b.id}`;
  return buildBookingIcs({
    uid: b.id,
    title: `${b.serviceTitle}${consultant && consultant.userId !== viewerId ? ` with ${consultant.name}` : ""}`,
    description: `You&Me session${others.length ? ` with ${others.join(", ")}` : ""}.\nDetails and chat: ${url}`,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    url,
    organizerName: consultant?.name ?? "You&Me",
  });
}
