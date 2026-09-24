import { sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/server/db";
import * as s from "@/server/db/schema";
import { seedReference } from "@/server/db/seed";
import { onUserCreated } from "@/server/auth/lifecycle";
import { resetRateLimits } from "@/server/rate-limit";
import { clearSettingsCache } from "@/server/settings";

/** Truncate every app table (keeps the schema and migrations). */
export async function resetDatabase() {
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'`,
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
  resetRateLimits();
  clearSettingsCache();
  await seedReference();
}

let counter = 0;

/** Create a fully onboarded user with optional profile fields, skills (slugs) and industries (names). */
export async function createUser(
  opts: {
    name?: string;
    email?: string;
    profile?: Partial<typeof s.profiles.$inferInsert>;
    skills?: string[];
    industries?: string[];
    roles?: string[];
    password?: string;
  } = {},
) {
  counter += 1;
  const id = crypto.randomUUID();
  const name = opts.name ?? `Test User ${counter}`;
  const email = opts.email ?? `user${counter}-${id.slice(0, 6)}@test.youandme.app`;
  await db.insert(s.user).values({ id, name, email, emailVerified: true });
  if (opts.password) {
    await db.insert(s.account).values({ id: crypto.randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(opts.password) });
  }
  await onUserCreated({ id, name, email });
  await db
    .update(s.profiles)
    .set({ onboardingCompletedAt: new Date(), ...opts.profile })
    .where(sql`${s.profiles.userId} = ${id}`);
  if (opts.skills?.length) {
    const skillRows = await db.select().from(s.skills).where(sql`${s.skills.slug} in ${opts.skills}`);
    await db.insert(s.userSkills).values(skillRows.map((k) => ({ userId: id, skillId: k.id })));
  }
  if (opts.industries?.length) {
    const rows = await db.select().from(s.industries).where(sql`${s.industries.name} in ${opts.industries}`);
    await db.insert(s.userIndustries).values(rows.map((i) => ({ userId: id, industryId: i.id })));
  }
  if (opts.roles?.length) await db.insert(s.userRoles).values(opts.roles.map((role) => ({ userId: id, role })));
  return { id, name, email };
}
