import "server-only";
import { count, desc, eq, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { bookings, payments, profiles } from "../db/schema";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/domain";
import { ADMIN_PAGE_SIZE, pageOffset } from "./utils";

const client = alias(profiles, "client");
const consultant = alias(profiles, "consultant");
const payer = alias(profiles, "payer");

export async function listBookings(opts: { status: BookingStatus | "all"; page: number }) {
  const where: SQL | undefined = opts.status !== "all" && BOOKING_STATUSES.includes(opts.status) ? eq(bookings.status, opts.status) : undefined;
  const [rows, total] = await Promise.all([
    db
      .select({
        id: bookings.id,
        status: bookings.status,
        serviceTitle: bookings.serviceTitle,
        pricingType: bookings.pricingType,
        amountCents: bookings.amountCents,
        platformFeeCents: bookings.platformFeeCents,
        currency: bookings.currency,
        startsAt: bookings.startsAt,
        createdAt: bookings.createdAt,
        clientId: bookings.clientId,
        clientName: client.displayName,
        consultantId: bookings.consultantId,
        consultantName: consultant.displayName,
        isDemo: client.isDemo,
      })
      .from(bookings)
      .leftJoin(client, eq(client.userId, bookings.clientId))
      .leftJoin(consultant, eq(consultant.userId, bookings.consultantId))
      .where(where)
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(opts.page)),
    db.select({ n: count() }).from(bookings).where(where),
  ]);
  return { rows, total: total[0]?.n ?? 0 };
}

export async function listPayments(page: number) {
  const [rows, total] = await Promise.all([
    db
      .select({
        id: payments.id,
        bookingId: payments.bookingId,
        provider: payments.provider,
        providerCheckoutId: payments.providerCheckoutId,
        providerPaymentId: payments.providerPaymentId,
        amountCents: payments.amountCents,
        applicationFeeCents: payments.applicationFeeCents,
        currency: payments.currency,
        status: payments.status,
        failureReason: payments.failureReason,
        createdAt: payments.createdAt,
        payerName: payer.displayName,
      })
      .from(payments)
      .leftJoin(payer, eq(payer.userId, payments.payerId))
      .orderBy(desc(payments.createdAt), desc(payments.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(page)),
    db.select({ n: count() }).from(payments),
  ]);
  return { rows, total: total[0]?.n ?? 0 };
}
