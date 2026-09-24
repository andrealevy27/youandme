import { index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { user } from "./auth";
import { conversationTypeEnum, messageKindEnum } from "./enums";
import { startups } from "./startups";

export type MessageAttachment = { url: string; name: string; size: number; mime: string };

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey().$defaultFn(id),
    type: conversationTypeEnum("type").notNull(),
    title: text("title"),
    startupId: text("startup_id").references(() => startups.id, { onDelete: "cascade" }),
    bookingId: text("booking_id"),
    matchId: text("match_id"),
    /** For direct conversations: sorted "userA:userB" to guarantee a single thread per pair. */
    directKey: text("direct_key").unique(),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_startup_idx").on(t.startupId)],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    typingAt: timestamp("typing_at", { withTimezone: true }),
    mutedAt: timestamp("muted_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("cm_user_idx").on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey().$defaultFn(id),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => user.id, { onDelete: "set null" }),
    kind: messageKindEnum("kind").notNull().default("text"),
    body: text("body").notNull().default(""),
    attachments: jsonb("attachments").$type<MessageAttachment[]>(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })],
);
