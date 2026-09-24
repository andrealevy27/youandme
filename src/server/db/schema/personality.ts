import { boolean, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { user } from "./auth";

/**
 * Working-style quiz. Each statement is answered on a 1–5 agreement scale and
 * pushes one dimension toward its left (-1) or right (+1) pole.
 */
export const personalityQuestions = pgTable("personality_questions", {
  id: text("id").primaryKey().$defaultFn(id),
  key: text("key").notNull().unique(),
  prompt: text("prompt").notNull(),
  topic: text("topic").notNull(),
  dimension: text("dimension").notNull(),
  polarity: smallint("polarity").notNull(),
  order: integer("order").notNull(),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
});

export const personalityAnswers = pgTable(
  "personality_answers",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => personalityQuestions.id, { onDelete: "cascade" }),
    value: smallint("value").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questionId] }), index("personality_answers_user_idx").on(t.userId)],
);

/** Scores per dimension in [-100, 100]; negative = left pole. */
export const personalityProfiles = pgTable("personality_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  scores: jsonb("scores").$type<Record<string, number>>().notNull(),
  version: integer("version").notNull().default(1),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});
