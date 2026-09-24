import { timestamp } from "drizzle-orm/pg-core";

/** Standard created/updated timestamps. `updatedAt` is bumped by the app layer via `$onUpdate`. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const id = () => crypto.randomUUID();
