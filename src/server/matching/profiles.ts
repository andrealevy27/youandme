import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import {
  industries,
  personalityProfiles,
  profiles,
  skills,
  startupMembers,
  userIndustries,
  userRoles,
  userSkills,
} from "../db/schema";
import type { MatchProfile } from "./types";
import type { SkillCategory } from "@/lib/domain";

/** Batch-load matching inputs for many users with a fixed number of queries. */
export async function loadMatchProfiles(userIds: string[], conn: DbOrTx = db): Promise<Map<string, MatchProfile>> {
  const out = new Map<string, MatchProfile>();
  if (!userIds.length) return out;
  const [profileRows, skillRows, industryRows, roleRows, personalityRows, memberRows] = await Promise.all([
    conn.select().from(profiles).where(inArray(profiles.userId, userIds)),
    conn
      .select({ userId: userSkills.userId, slug: skills.slug, name: skills.name, category: skills.category, level: userSkills.level })
      .from(userSkills)
      .innerJoin(skills, eq(skills.id, userSkills.skillId))
      .where(inArray(userSkills.userId, userIds)),
    conn
      .select({ userId: userIndustries.userId, slug: industries.slug, name: industries.name })
      .from(userIndustries)
      .innerJoin(industries, eq(industries.id, userIndustries.industryId))
      .where(inArray(userIndustries.userId, userIds)),
    conn.select().from(userRoles).where(inArray(userRoles.userId, userIds)),
    conn.select().from(personalityProfiles).where(inArray(personalityProfiles.userId, userIds)),
    conn
      .select({ userId: startupMembers.userId })
      .from(startupMembers)
      .where(and(inArray(startupMembers.userId, userIds), isNull(startupMembers.removedAt))),
  ]);

  const group = <T extends { userId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) (m.get(r.userId) ?? m.set(r.userId, []).get(r.userId)!).push(r);
    return m;
  };
  const skillsBy = group(skillRows);
  const industriesBy = group(industryRows);
  const rolesBy = group(roleRows);
  const personalityBy = new Map(personalityRows.map((p) => [p.userId, p.scores]));
  const withStartup = new Set(memberRows.map((m) => m.userId));

  for (const p of profileRows) {
    out.set(p.userId, {
      userId: p.userId,
      name: p.displayName,
      roles: (rolesBy.get(p.userId) ?? []).map((r) => r.role),
      skills: (skillsBy.get(p.userId) ?? []).map((s) => ({ slug: s.slug, name: s.name, category: s.category as SkillCategory, level: s.level })),
      industries: (industriesBy.get(p.userId) ?? []).map((i) => ({ slug: i.slug, name: i.name })),
      cofounderTypesSought: p.cofounderTypes as MatchProfile["cofounderTypesSought"],
      stagePreferences: p.stagePreferences as MatchProfile["stagePreferences"],
      commitment: p.commitment,
      availability: p.availability,
      workMode: p.workMode,
      ambition: p.ambition,
      founderExperience: p.founderExperience,
      city: p.city,
      country: p.country,
      timezone: p.timezone,
      personality: personalityBy.get(p.userId) ?? null,
      hasStartup: withStartup.has(p.userId),
    });
  }
  return out;
}

export async function loadMatchProfile(userId: string, conn: DbOrTx = db) {
  return (await loadMatchProfiles([userId], conn)).get(userId) ?? null;
}
