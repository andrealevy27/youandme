import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";
import { matches } from "./matching";

/** Student mode: a 2-week cofounder trial between two matched people. Additive table. */
export const cofounderTrials = pgTable(
  "cofounder_trials",
  {
    id: text("id").primaryKey().$defaultFn(id),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    /** Copied from the match (ordered pair) so queries don't need a join. */
    userAId: text("user_a_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userBId: text("user_b_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startedBy: text("started_by").references(() => user.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** Shared checklist: key → ISO time it was ticked (absent = not yet). */
    checklist: jsonb("checklist").$type<Record<string, string>>().notNull().default({}),
    /** "continue" | "stop" — each person's check-in. */
    decisionA: text("decision_a"),
    decisionB: text("decision_b"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("cofounder_trials_match_idx").on(t.matchId), index("cofounder_trials_a_idx").on(t.userAId), index("cofounder_trials_b_idx").on(t.userBId)],
);
