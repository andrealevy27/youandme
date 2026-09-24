import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { user } from "./auth";
import { connectionStatusEnum, followTargetEnum, saveTargetEnum } from "./enums";

/** Mutual professional connection (request → accept). Distinct from cofounder Interest/Match. */
export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey().$defaultFn(id),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: connectionStatusEnum("status").notNull().default("pending"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("connections_pair_idx").on(t.requesterId, t.addresseeId),
    index("connections_addressee_idx").on(t.addresseeId, t.status),
  ],
);

/** One-way follow of a person or startup. */
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: followTargetEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.targetType, t.targetId] }), index("follows_target_idx").on(t.targetType, t.targetId)],
);

export const savedCollections = pgTable(
  "saved_collections",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_collections_user_idx").on(t.userId)],
);

export const savedItems = pgTable(
  "saved_items",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").references(() => savedCollections.id, { onDelete: "set null" }),
    targetType: saveTargetEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_items_unique_idx").on(t.userId, t.targetType, t.targetId), index("saved_items_collection_idx").on(t.collectionId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    data: jsonb("data").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt), index("notifications_unread_idx").on(t.userId, t.readAt)],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    inApp: boolean("in_app").notNull().default(true),
    email: boolean("email").notNull().default(true),
    push: boolean("push").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type] })],
);
