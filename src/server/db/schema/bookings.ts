import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";
import { consultantProfiles, consultantServices } from "./consultants";
import { bookingStatusEnum, paymentStatusEnum, pricingTypeEnum, reviewStatusEnum } from "./enums";
import { startups } from "./startups";

export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey().$defaultFn(id),
    serviceId: text("service_id")
      .notNull()
      .references(() => consultantServices.id, { onDelete: "restrict" }),
    consultantId: text("consultant_id")
      .notNull()
      .references(() => consultantProfiles.userId, { onDelete: "restrict" }),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    startupId: text("startup_id").references(() => startups.id, { onDelete: "set null" }),
    status: bookingStatusEnum("status").notNull().default("pending_payment"),
    /** Snapshot of the service at booking time — service edits never change past bookings. */
    serviceTitle: text("service_title").notNull(),
    pricingType: pricingTypeEnum("pricing_type").notNull(),
    quantity: smallint("quantity").notNull().default(1),
    amountCents: integer("amount_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents").notNull(),
    currency: text("currency").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    projectContext: text("project_context"),
    conversationId: text("conversation_id"),
    calendarEventId: text("calendar_event_id"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledById: text("cancelled_by_id"),
    cancelReason: text("cancel_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("bookings_consultant_time_idx").on(t.consultantId, t.startsAt),
    index("bookings_client_idx").on(t.clientId, t.startsAt),
    index("bookings_status_idx").on(t.status),
    // A consultant can never hold two live bookings at the same start time.
    uniqueIndex("bookings_no_double_booking_idx")
      .on(t.consultantId, t.startsAt)
      .where(sql`${t.status} in ('pending_payment','confirmed')`),
  ],
);

export const bookingParticipants = pgTable(
  "booking_participants",
  {
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** client | consultant | teammate */
    role: text("role").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("booking_participants_idx").on(t.bookingId, t.userId), index("bp_user_idx").on(t.userId)],
);

/** Payment records hold provider IDs only — never card data. */
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(id),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    payerId: text("payer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    providerCheckoutId: text("provider_checkout_id"),
    providerPaymentId: text("provider_payment_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    amountCents: integer("amount_cents").notNull(),
    applicationFeeCents: integer("application_fee_cents").notNull(),
    currency: text("currency").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    ...timestamps,
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    uniqueIndex("payments_checkout_idx").on(t.providerCheckoutId),
    index("payments_status_idx").on(t.status),
  ],
);

/** Only one review per completed booking; enforced by unique index + service checks. */
export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey().$defaultFn(id),
    bookingId: text("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "cascade" }),
    consultantId: text("consultant_id")
      .notNull()
      .references(() => consultantProfiles.userId, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expertise: smallint("expertise").notNull(),
    communication: smallint("communication").notNull(),
    value: smallint("value").notNull(),
    reliability: smallint("reliability").notNull(),
    overall: smallint("overall").notNull(),
    body: text("body"),
    status: reviewStatusEnum("status").notNull().default("published"),
    ...timestamps,
  },
  (t) => [index("reviews_consultant_idx").on(t.consultantId, t.status)],
);
