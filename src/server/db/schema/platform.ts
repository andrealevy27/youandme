import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";
import { adminRoleEnum, aiRoleEnum, waitlistStatusEnum } from "./enums";

/** Runtime configuration editable by admins (matching weights, waitlist, commission…). */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const platformInvites = pgTable("platform_invites", {
  id: text("id").primaryKey().$defaultFn(id),
  code: text("code").notNull().unique(),
  email: text("email"),
  note: text("note"),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: text("id").primaryKey().$defaultFn(id),
    email: text("email").notNull().unique(),
    name: text("name"),
    intent: text("intent"),
    note: text("note"),
    status: waitlistStatusEnum("status").notNull().default("waiting"),
    inviteId: text("invite_id").references(() => platformInvites.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("waitlist_status_idx").on(t.status, t.createdAt)],
);

/** Admin access is permission-based; permissions per role live in server/authz/admin.ts. */
export const adminUsers = pgTable("admin_users", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: adminRoleEnum("role").notNull(),
  grantedById: text("granted_by_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(id),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_target_idx").on(t.targetType, t.targetId)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    properties: jsonb("properties").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analytics_name_idx").on(t.name, t.createdAt), index("analytics_user_idx").on(t.userId)],
);

export const aiThreads = pgTable(
  "ai_threads",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ...timestamps,
  },
  (t) => [index("ai_threads_user_idx").on(t.userId, t.updatedAt)],
);

export type AiResultCard =
  | { kind: "person"; userId: string }
  | { kind: "consultant"; userId: string }
  | { kind: "startup"; startupId: string };

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: text("id").primaryKey().$defaultFn(id),
    threadId: text("thread_id")
      .notNull()
      .references(() => aiThreads.id, { onDelete: "cascade" }),
    role: aiRoleEnum("role").notNull(),
    content: text("content").notNull(),
    /** Only IDs returned by concierge tools — the UI never renders profiles the model invented. */
    cards: jsonb("cards").$type<AiResultCard[]>(),
    toolTrace: jsonb("tool_trace").$type<{ tool: string; input: unknown }[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_messages_thread_idx").on(t.threadId, t.createdAt)],
);

export const fileUploads = pgTable(
  "file_uploads",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    purpose: text("purpose").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("file_uploads_user_idx").on(t.userId)],
);

/** You&Me Pro — architecture only; entitlements are gated by the `pro_enabled` setting. */
export const subscriptions = pgTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  ...timestamps,
});
