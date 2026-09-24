import { date, index, integer, jsonb, pgTable, real, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { user } from "./auth";
import { interestKindEnum, recommendationActionEnum } from "./enums";
import type { CompatibilityFactor, FrictionPoint } from "@/server/matching/types";

/** Hard filters and preferences for cofounder recommendations. */
export const matchPreferences = pgTable("match_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** anywhere | same_country | same_city */
  locationScope: text("location_scope").notNull().default("anywhere"),
  remoteOk: text("remote_ok").notNull().default("yes"),
  industryIds: text("industry_ids").array(),
  minCommitment: text("min_commitment"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Cached pairwise compatibility. userAId < userBId lexicographically. */
export const compatibilityResults = pgTable(
  "compatibility_results",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userAId: text("user_a_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: smallint("score").notNull(),
    factors: jsonb("factors").$type<CompatibilityFactor[]>().notNull(),
    frictions: jsonb("frictions").$type<FrictionPoint[]>().notNull(),
    explanation: text("explanation").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("compat_pair_idx").on(t.userAId, t.userBId, t.algorithmVersion)],
);

/** Daily curated recommendations — stored so results are stable for the day. */
export const recommendations = pgTable(
  "recommendations",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    forDate: date("for_date").notNull(),
    kind: text("kind").notNull().default("cofounder"),
    rank: smallint("rank").notNull(),
    score: smallint("score").notNull(),
    rankScore: real("rank_score").notNull(),
    factors: jsonb("factors").$type<CompatibilityFactor[]>().notNull(),
    frictions: jsonb("frictions").$type<FrictionPoint[]>().notNull(),
    explanation: text("explanation").notNull(),
    reason: text("reason").notNull(),
    action: recommendationActionEnum("action").notNull().default("none"),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    actedAt: timestamp("acted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("recommendations_unique_idx").on(t.userId, t.candidateId, t.forDate, t.kind),
    index("recommendations_user_date_idx").on(t.userId, t.forDate),
  ],
);

/** One-directional cofounder interest (or pass). Mutual interest creates a Match. */
export const interests = pgTable(
  "interests",
  {
    id: text("id").primaryKey().$defaultFn(id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: interestKindEnum("kind").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("interests_pair_idx").on(t.fromUserId, t.toUserId), index("interests_to_idx").on(t.toUserId, t.kind)],
);

/** Mutual cofounder match. userAId < userBId. */
export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey().$defaultFn(id),
    userAId: text("user_a_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score"),
    conversationId: text("conversation_id"),
    unmatchedAt: timestamp("unmatched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("matches_pair_idx").on(t.userAId, t.userBId),
    index("matches_a_idx").on(t.userAId),
    index("matches_b_idx").on(t.userBId),
  ],
);
