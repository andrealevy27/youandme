import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

declare global {
  var __youandmeSql: ReturnType<typeof postgres> | undefined;
}

/** Reuse the connection pool across hot reloads in development. */
const sql = globalThis.__youandmeSql ?? postgres(env.DATABASE_URL, { max: env.NODE_ENV === "production" ? 10 : 5 });
if (env.NODE_ENV !== "production") globalThis.__youandmeSql = sql;

export const db = drizzle(sql, { schema, casing: "snake_case" });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;
export { schema, sql as pgClient };
