import { index, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";

/** Student mode: in-person team-hunt events. Additive tables only. */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey().$defaultFn(id),
    /** Short join code used in the link and QR code, e.g. /e/K7Q2MX */
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /** IANA time zone the organizer created it in; all event times are shown in it. */
    timezone: text("timezone").notNull().default("America/New_York"),
    /** School slug from src/lib/schools.ts; null = open to students from any school. */
    school: text("school"),
    /** "active" | "closed" — closed events keep their introductions but accept no new attendees. */
    status: text("status").notNull().default("active"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("events_code_idx").on(t.code), index("events_starts_idx").on(t.startsAt)],
);

export const eventAttendees = pgTable(
  "event_attendees",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index("event_attendees_user_idx").on(t.userId)],
);

/** "Your people to meet tonight": stored so the list is stable and stays after the event. */
export const eventIntroductions = pgTable(
  "event_introductions",
  {
    id: text("id").primaryKey().$defaultFn(id),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rank: smallint("rank").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_intro_unique_idx").on(t.eventId, t.userId, t.targetId), index("event_intro_user_idx").on(t.eventId, t.userId)],
);
