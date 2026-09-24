import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";
import { consultantStatusEnum, pricingTypeEnum } from "./enums";

/** Extensible: admins add categories from the admin panel. */
export const consultantCategories = pgTable("consultant_categories", {
  id: text("id").primaryKey().$defaultFn(id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  /** Search hints used by the need interpreter (e.g. "tiktok", "paid social"). */
  keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const consultantProfiles = pgTable(
  "consultant_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    headline: text("headline").notNull(),
    bio: text("bio"),
    yearsExperience: smallint("years_experience"),
    hourlyRateCents: integer("hourly_rate_cents"),
    currency: text("currency").notNull().default("usd"),
    languages: text("languages").array().notNull().default(sql`'{English}'::text[]`),
    previousCompanies: text("previous_companies").array().notNull().default(sql`'{}'::text[]`),
    stagesServed: text("stages_served").array().notNull().default(sql`'{}'::text[]`),
    remoteAvailable: boolean("remote_available").notNull().default(true),
    acceptingClients: boolean("accepting_clients").notNull().default(true),
    timezone: text("timezone").notNull().default("UTC"),
    minNoticeHours: smallint("min_notice_hours").notNull().default(24),
    status: consultantStatusEnum("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    /** Aggregates maintained by the reviews/bookings services — never set directly. */
    ratingAvg: real("rating_avg"),
    reviewCount: integer("review_count").notNull().default(0),
    engagementCount: integer("engagement_count").notNull().default(0),
    stripeAccountId: text("stripe_account_id"),
    stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
    /** Calendar integration architecture: provider + opaque connection id. */
    calendarProvider: text("calendar_provider"),
    calendarConnectionId: text("calendar_connection_id"),
    ...timestamps,
  },
  (t) => [
    index("consultant_profiles_status_idx").on(t.status, t.acceptingClients),
    index("consultant_profiles_search_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${t.headline},'') || ' ' || coalesce(${t.bio},''))`,
    ),
  ],
);

export const consultantProfileCategories = pgTable(
  "consultant_profile_categories",
  {
    consultantId: text("consultant_id")
      .notNull()
      .references(() => consultantProfiles.userId, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => consultantCategories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.consultantId, t.categoryId] }), index("cpc_category_idx").on(t.categoryId)],
);

export const consultantPortfolioItems = pgTable(
  "consultant_portfolio_items",
  {
    id: text("id").primaryKey().$defaultFn(id),
    consultantId: text("consultant_id")
      .notNull()
      .references(() => consultantProfiles.userId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("portfolio_consultant_idx").on(t.consultantId)],
);

export const consultantServices = pgTable(
  "consultant_services",
  {
    id: text("id").primaryKey().$defaultFn(id),
    consultantId: text("consultant_id")
      .notNull()
      .references(() => consultantProfiles.userId, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => consultantCategories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    pricingType: pricingTypeEnum("pricing_type").notNull(),
    /** fixed/package: total; hourly: per hour; recurring: per billing interval. */
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    billingInterval: text("billing_interval"),
    includes: text("includes").array().notNull().default(sql`'{}'::text[]`),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("services_consultant_idx").on(t.consultantId, t.active)],
);

/** Weekly availability rules in the consultant's timezone (minutes from midnight). */
export const consultantAvailability = pgTable(
  "consultant_availability",
  {
    id: text("id").primaryKey().$defaultFn(id),
    consultantId: text("consultant_id")
      .notNull()
      .references(() => consultantProfiles.userId, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
  },
  (t) => [index("availability_consultant_idx").on(t.consultantId, t.weekday)],
);

/** Dates the consultant is unavailable (vacations, holidays). */
export const consultantTimeOff = pgTable(
  "consultant_time_off",
  {
    id: text("id").primaryKey().$defaultFn(id),
    consultantId: text("consultant_id")
      .notNull()
      .references(() => consultantProfiles.userId, { onDelete: "cascade" }),
    day: date("day").notNull(),
  },
  (t) => [uniqueIndex("time_off_unique_idx").on(t.consultantId, t.day)],
);
