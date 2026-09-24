import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { bookings, consultantProfiles, consultantServices, payments, user } from "../db/schema";
import { AppError, forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { logger } from "../logger";
import { getSetting } from "../settings";
import { applyBookingEvent, confirmPayment, lockBooking, notifyAll, setLatestPaymentStatus } from "../bookings/lifecycle";
import { PENDING_PAYMENT_TTL_MINUTES } from "../bookings/state";
import { DevPaymentProvider } from "./dev";
import { StripePaymentProvider } from "./stripe";
import { paymentAvailability, paymentMode } from "./availability";
import type { PaymentEvent, PaymentProvider } from "./types";

export type { PaymentProvider, PaymentEvent } from "./types";
export { paymentAvailability, paymentMode, type PaymentAvailability } from "./availability";
export { computePlatformFee, consultantPayout } from "./fees";

let cached: PaymentProvider | null | undefined;

/** The active provider, or null when this environment can't take payments. */
export function getPaymentProvider(): PaymentProvider | null {
  if (cached !== undefined) return cached;
  const mode = paymentMode();
  cached = mode === "dev" ? new DevPaymentProvider() : mode === "stripe" ? new StripePaymentProvider() : null;
  return cached;
}

export function getStripeProvider(): StripePaymentProvider | null {
  return paymentMode() === "stripe" ? (getPaymentProvider() as StripePaymentProvider) : null;
}

const INTERVALS = ["day", "week", "month", "year"] as const;

/**
 * Open a checkout for the viewer's unpaid booking. With the dev provider the booking
 * is confirmed immediately (test mode — no money moves).
 */
export async function startCheckout(viewerId: string, bookingId: string, opts: { groupChat?: boolean } = {}) {
  const provider = getPaymentProvider();
  if (!provider) throw new AppError("UNAVAILABLE", "Online payments aren't set up on this environment. Message the consultant to arrange a session.");

  const [row] = await db
    .select({ b: bookings, c: consultantProfiles, billingInterval: consultantServices.billingInterval, email: user.email })
    .from(bookings)
    .innerJoin(consultantProfiles, eq(consultantProfiles.userId, bookings.consultantId))
    .innerJoin(consultantServices, eq(consultantServices.id, bookings.serviceId))
    .innerJoin(user, eq(user.id, bookings.clientId))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) throw notFound("That booking");
  const b = row.b;
  if (b.clientId !== viewerId) throw forbidden("Only the person who made this booking can pay for it.");
  if (b.status !== "pending_payment") throw new AppError("CONFLICT", "This booking doesn't need payment.");
  if (Date.now() - b.createdAt.getTime() > PENDING_PAYMENT_TTL_MINUTES * 60_000) {
    throw new AppError("CONFLICT", "This booking's time hold has expired. Please pick a time again.");
  }
  const availability = paymentAvailability({ stripeAccountId: row.c.stripeAccountId, stripeChargesEnabled: row.c.stripeChargesEnabled });
  if (!availability.payable) throw new AppError("UNAVAILABLE", availability.reason);

  // Reuse the group-chat choice from an earlier attempt when retrying.
  let groupChat = opts.groupChat;
  if (groupChat === undefined) {
    const [prev] = await db.select({ metadata: payments.metadata }).from(payments).where(eq(payments.bookingId, b.id)).orderBy(desc(payments.createdAt)).limit(1);
    groupChat = prev?.metadata?.groupChat === "1";
  }
  const feeBps = await getSetting("platform_fee_bps");
  const [payment] = await db
    .insert(payments)
    .values({
      bookingId: b.id,
      payerId: viewerId,
      provider: provider.name,
      amountCents: b.amountCents,
      applicationFeeCents: b.platformFeeCents,
      currency: b.currency,
      status: "pending",
      metadata: { groupChat: groupChat ? "1" : "0" },
    })
    .returning();

  const interval = (INTERVALS as readonly string[]).includes(row.billingInterval ?? "") ? (row.billingInterval as (typeof INTERVALS)[number]) : "month";
  try {
    const result = await provider.createCheckout({
      bookingId: b.id,
      paymentId: payment!.id,
      serviceTitle: b.serviceTitle,
      pricingType: b.pricingType,
      billingInterval: interval,
      amountCents: b.amountCents,
      platformFeeCents: b.platformFeeCents,
      platformFeeBps: feeBps,
      currency: b.currency,
      clientEmail: row.email,
      consultantStripeAccountId: row.c.stripeAccountId,
    });
    await db.update(payments).set({ providerCheckoutId: result.checkoutId }).where(eq(payments.id, payment!.id));
    if (result.confirmed) {
      await confirmPayment({ paymentRowId: payment!.id, providerPaymentId: result.confirmed.paymentId, providerSubscriptionId: result.confirmed.subscriptionId });
    }
    return { redirectUrl: result.redirectUrl, testMode: provider.testMode, provider: provider.name };
  } catch (err) {
    await db.update(payments).set({ status: "cancelled", failureReason: "checkout_failed" }).where(eq(payments.id, payment!.id));
    if (err instanceof AppError) throw err;
    logger.error("checkout_create_failed", { err, bookingId: b.id });
    throw new AppError("UNAVAILABLE", "We couldn't open checkout. Please try again in a moment.");
  }
}

/** Refund the latest confirmed payment for a booking through its provider. */
export async function refundLatestPayment(bookingId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .orderBy(desc(payments.createdAt))
    .limit(5)
    .then((rows) => rows.filter((p) => p.status === "confirmed" || p.status === "completed" || p.status === "disputed"));
  if (!payment) return { refunded: false as const, reason: "no_payment" };
  const provider = payment.provider === "dev" ? new DevPaymentProvider() : getStripeProvider();
  if (!provider) throw new AppError("UNAVAILABLE", "Refunds can't be processed on this environment right now.");
  const { refundId } = await provider.refund(payment);
  await db
    .update(payments)
    .set({ status: "refunded", metadata: { ...(payment.metadata ?? {}), refundId: refundId ?? "" } })
    .where(eq(payments.id, payment.id));
  return { refunded: true as const, refundId };
}

/** Apply a verified provider event. Every branch is idempotent (state-checked) so webhook retries are safe. */
export async function processPaymentEvent(event: PaymentEvent): Promise<string> {
  switch (event.type) {
    case "checkout_completed": {
      if (!event.paid) return "awaiting_async_payment";
      const [payment] = await db.select().from(payments).where(eq(payments.providerCheckoutId, event.checkoutId)).limit(1);
      if (!payment) return "unknown_checkout";
      const outcome = await confirmPayment({ paymentRowId: payment.id, providerPaymentId: event.paymentId, providerSubscriptionId: event.subscriptionId });
      if (outcome.status === "needs_refund") {
        // Paid after the hold lapsed or after cancellation — never keep money for a session that won't happen.
        await refundLatestPayment(payment.bookingId).catch((err) => logger.error("late_payment_refund_failed", { err, bookingId: payment.bookingId }));
        await audit({ actorId: null, action: "booking.late_payment_refunded", targetType: "booking", targetId: payment.bookingId });
      }
      return outcome.status;
    }
    case "checkout_expired": {
      const [payment] = await db.select().from(payments).where(eq(payments.providerCheckoutId, event.checkoutId)).limit(1);
      if (!payment || payment.status !== "pending") return "noop";
      await db.transaction(async (tx) => {
        await tx.update(payments).set({ status: "cancelled", failureReason: "checkout_expired" }).where(eq(payments.id, payment.id));
        const b = await lockBooking(tx, payment.bookingId);
        if (b.status === "pending_payment") {
          await applyBookingEvent(tx, b, "expire", { cancelledAt: new Date(), cancelReason: "Checkout expired before payment." });
        }
      });
      return "expired";
    }
    case "refunded": {
      const [payment] = await db.select().from(payments).where(eq(payments.providerPaymentId, event.paymentId)).limit(1);
      if (!payment || !event.fully) return "noop";
      const changed = await db.transaction(async (tx) => {
        await tx.update(payments).set({ status: "refunded" }).where(eq(payments.id, payment.id));
        const b = await lockBooking(tx, payment.bookingId);
        if (b.status === "refunded") return null;
        return applyBookingEvent(tx, b, "refund").catch(() => null);
      });
      if (changed) {
        await audit({ actorId: null, action: "booking.refunded_by_provider", targetType: "booking", targetId: changed.id, metadata: { provider: payment.provider } });
        await notifyAll(changed, { title: "Your booking was refunded", body: changed.serviceTitle });
      }
      return changed ? "refunded" : "noop";
    }
    case "disputed": {
      const [payment] = await db.select().from(payments).where(eq(payments.providerPaymentId, event.paymentId)).limit(1);
      if (!payment) return "noop";
      const changed = await db.transaction(async (tx) => {
        await setLatestPaymentStatus(tx, payment.bookingId, "disputed", event.reason ?? undefined);
        const b = await lockBooking(tx, payment.bookingId);
        if (b.status === "disputed") return null;
        return applyBookingEvent(tx, b, "dispute").catch(() => null);
      });
      await audit({ actorId: null, action: "booking.chargeback_opened", targetType: "booking", targetId: payment.bookingId, metadata: { reason: event.reason } });
      return changed ? "disputed" : "noop";
    }
    case "account_updated": {
      await db
        .update(consultantProfiles)
        .set({ stripeChargesEnabled: event.chargesEnabled })
        .where(and(eq(consultantProfiles.stripeAccountId, event.accountId)));
      return "account_updated";
    }
    case "ignored":
      return "ignored";
  }
}

// ── Stripe Connect onboarding for consultants ───────────────────────────────

export type PayoutStatus =
  | { configured: false }
  | { configured: true; connected: false }
  | { configured: true; connected: true; chargesEnabled: boolean; detailsSubmitted: boolean; payoutsEnabled: boolean };

export async function getPayoutStatus(userId: string, opts: { refresh?: boolean } = {}): Promise<PayoutStatus> {
  const stripe = getStripeProvider();
  if (!stripe) return { configured: false };
  const [c] = await db.select().from(consultantProfiles).where(eq(consultantProfiles.userId, userId)).limit(1);
  if (!c?.stripeAccountId) return { configured: true, connected: false };
  if (!opts.refresh) return { configured: true, connected: true, chargesEnabled: c.stripeChargesEnabled, detailsSubmitted: c.stripeChargesEnabled, payoutsEnabled: c.stripeChargesEnabled };
  try {
    const status = await stripe.getAccountStatus(c.stripeAccountId);
    if (status.chargesEnabled !== c.stripeChargesEnabled) {
      await db.update(consultantProfiles).set({ stripeChargesEnabled: status.chargesEnabled }).where(eq(consultantProfiles.userId, userId));
    }
    return { configured: true, connected: true, ...status };
  } catch (err) {
    logger.warn("stripe_account_status_failed", { err });
    return { configured: true, connected: true, chargesEnabled: c.stripeChargesEnabled, detailsSubmitted: false, payoutsEnabled: false };
  }
}

/** Create (once) a connected account and return a fresh onboarding link. */
export async function startConnectOnboarding(userId: string): Promise<string> {
  const stripe = getStripeProvider();
  if (!stripe) throw new AppError("UNAVAILABLE", "Payments aren't configured on this environment.");
  const [row] = await db
    .select({ c: consultantProfiles, email: user.email })
    .from(consultantProfiles)
    .innerJoin(user, eq(user.id, consultantProfiles.userId))
    .where(eq(consultantProfiles.userId, userId))
    .limit(1);
  if (!row) throw new AppError("VALIDATION", "Set up your consultant profile first.");
  let accountId = row.c.stripeAccountId;
  if (!accountId) {
    accountId = await stripe.createConnectedAccount(row.email, userId);
    await db.update(consultantProfiles).set({ stripeAccountId: accountId }).where(eq(consultantProfiles.userId, userId));
    await audit({ actorId: userId, action: "payments.connect_account_created", targetType: "consultant", targetId: userId });
  }
  return stripe.createOnboardingLink(accountId);
}

export async function getPayoutDashboardLink(userId: string): Promise<string> {
  const stripe = getStripeProvider();
  if (!stripe) throw new AppError("UNAVAILABLE", "Payments aren't configured on this environment.");
  const [c] = await db.select().from(consultantProfiles).where(eq(consultantProfiles.userId, userId)).limit(1);
  if (!c?.stripeAccountId) throw new AppError("VALIDATION", "Connect a payout account first.");
  return stripe.createDashboardLink(c.stripeAccountId);
}
