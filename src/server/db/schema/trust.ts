import { index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { user } from "./auth";
import { reportReasonEnum, reportStatusEnum, reportTargetEnum, verificationStatusEnum, verificationTypeEnum } from "./enums";

export const identityVerifications = pgTable(
  "identity_verifications",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: verificationTypeEnum("type").notNull(),
    status: verificationStatusEnum("status").notNull().default("pending"),
    /** e.g. the university email domain or LinkedIn URL that was checked. */
    subject: text("subject"),
    tokenHash: text("token_hash"),
    reviewedById: text("reviewed_by_id").references(() => user.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_user_idx").on(t.userId, t.type)],
);

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey().$defaultFn(id),
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"),
    /** Snapshot of the reported content so moderation still works if it is edited or deleted. */
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    status: reportStatusEnum("status").notNull().default("open"),
    resolvedById: text("resolved_by_id").references(() => user.id, { onDelete: "set null" }),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt), index("reports_target_idx").on(t.targetType, t.targetId)],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("blocks_blocked_idx").on(t.blockedId)],
);
