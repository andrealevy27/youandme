import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { profiles } from "../db/schema";

/** Updates last-active at most every 10 minutes (used for recommendation ranking). */
export async function touchLastActive(userId: string) {
  await db
    .update(profiles)
    .set({ lastActiveAt: new Date() })
    .where(and(eq(profiles.userId, userId), lt(profiles.lastActiveAt, new Date(Date.now() - 10 * 60_000))));
}
