import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  consultantProfiles,
  educations,
  experiences,
  identityVerifications,
  industries,
  personalityProfiles,
  profiles,
  skills,
  startupMembers,
  startups,
  userIndustries,
  userRoles,
  userSkills,
} from "../db/schema";
import { canViewProfile } from "../privacy/visibility";

/** Compact public representation of a person used by cards, search results and AI tools. */
export type PersonSummary = {
  userId: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  university: string | null;
  roles: string[];
  skills: string[];
  industries: string[];
  lookingForCofounder: boolean;
  commitment: (typeof profiles.$inferSelect)["commitment"];
  availability: (typeof profiles.$inferSelect)["availability"];
  isDemo: boolean;
  verified: string[];
};

/** Batch-build summaries (fixed query count). Callers must have already applied visibility filtering. */
export async function getPersonSummaries(userIds: string[]): Promise<PersonSummary[]> {
  if (!userIds.length) return [];
  const [rows, skillRows, industryRows, roleRows, verRows] = await Promise.all([
    db.select().from(profiles).where(inArray(profiles.userId, userIds)),
    db
      .select({ userId: userSkills.userId, name: skills.name, isPrimary: userSkills.isPrimary, level: userSkills.level })
      .from(userSkills)
      .innerJoin(skills, eq(skills.id, userSkills.skillId))
      .where(inArray(userSkills.userId, userIds))
      .orderBy(desc(userSkills.isPrimary), desc(userSkills.level)),
    db
      .select({ userId: userIndustries.userId, name: industries.name })
      .from(userIndustries)
      .innerJoin(industries, eq(industries.id, userIndustries.industryId))
      .where(inArray(userIndustries.userId, userIds)),
    db.select().from(userRoles).where(inArray(userRoles.userId, userIds)),
    db
      .select({ userId: identityVerifications.userId, type: identityVerifications.type })
      .from(identityVerifications)
      .where(and(inArray(identityVerifications.userId, userIds), eq(identityVerifications.status, "verified"))),
  ]);
  const byId = new Map(rows.map((r) => [r.userId, r]));
  return userIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      userId: p.userId,
      handle: p.handle,
      name: p.displayName,
      avatarUrl: p.avatarUrl,
      headline: p.headline,
      currentRole: p.currentRole,
      currentCompany: p.currentCompany,
      location: p.location ?? ([p.city, p.country].filter(Boolean).join(", ") || null),
      university: p.university,
      roles: roleRows.filter((r) => r.userId === p.userId).map((r) => r.role),
      skills: skillRows.filter((s) => s.userId === p.userId).map((s) => s.name),
      industries: industryRows.filter((i) => i.userId === p.userId).map((i) => i.name),
      lookingForCofounder: p.lookingForCofounder,
      commitment: p.commitment,
      availability: p.availability,
      isDemo: p.isDemo,
      verified: [...new Set(verRows.filter((v) => v.userId === p.userId).map((v) => v.type))],
    }));
}

export async function findUserIdByHandle(handle: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(sql`lower(${profiles.handle}) = ${handle.toLowerCase()}`, isNull(profiles.deletedAt)))
    .limit(1);
  return row?.userId ?? null;
}

/** Full profile for the profile page. Returns null when the viewer may not see it. */
export async function getFullProfile(viewerId: string, targetId: string) {
  if (!(await canViewProfile(viewerId, targetId))) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, targetId)).limit(1);
  if (!profile) return null;
  const [summary] = await getPersonSummaries([targetId]);
  const [exp, edu, personality, consultant, memberships, skillDetail] = await Promise.all([
    db.select().from(experiences).where(eq(experiences.userId, targetId)).orderBy(desc(experiences.isCurrent), desc(experiences.startYear)),
    db.select().from(educations).where(eq(educations.userId, targetId)).orderBy(desc(educations.endYear)),
    db.select().from(personalityProfiles).where(eq(personalityProfiles.userId, targetId)).limit(1),
    db.select().from(consultantProfiles).where(eq(consultantProfiles.userId, targetId)).limit(1),
    db
      .select({ startup: startups, role: startupMembers.role, title: startupMembers.title, isAdmin: startupMembers.isAdmin })
      .from(startupMembers)
      .innerJoin(startups, eq(startups.id, startupMembers.startupId))
      .where(and(eq(startupMembers.userId, targetId), isNull(startupMembers.removedAt), isNull(startups.deletedAt))),
    db
      .select({ id: skills.id, slug: skills.slug, name: skills.name, category: skills.category, level: userSkills.level, isPrimary: userSkills.isPrimary })
      .from(userSkills)
      .innerJoin(skills, eq(skills.id, userSkills.skillId))
      .where(eq(userSkills.userId, targetId)),
  ]);
  return {
    profile,
    summary: summary!,
    experiences: exp,
    educations: edu,
    personality: personality[0] ?? null,
    consultant: consultant[0]?.status === "approved" || viewerId === targetId ? (consultant[0] ?? null) : null,
    startups: memberships.filter((m) => m.startup.visibility !== "hidden" || viewerId === targetId),
    skills: skillDetail,
  };
}

/**
 * Profile completeness with concrete, honest suggestions (no fake urgency).
 * Weighted so the fields that matter most for matching count most.
 */
export async function getProfileCompletion(userId: string) {
  const full = await getFullProfile(userId, userId);
  if (!full) return { percent: 0, missing: [] as { key: string; label: string; href: string }[] };
  const p = full.profile;
  const checks: { key: string; label: string; href: string; weight: number; done: boolean }[] = [
    { key: "photo", label: "Add a profile photo", href: "/profile/edit#photo", weight: 10, done: !!p.avatarUrl },
    { key: "headline", label: "Write a headline", href: "/profile/edit#basics", weight: 10, done: !!p.headline },
    { key: "bio", label: "Add a short bio", href: "/profile/edit#basics", weight: 10, done: !!p.bio && p.bio.length > 40 },
    { key: "skills", label: "Add your skills", href: "/profile/edit#skills", weight: 15, done: full.skills.length >= 2 },
    { key: "industries", label: "Pick industries you care about", href: "/profile/edit#skills", weight: 10, done: full.summary.industries.length > 0 },
    { key: "quiz", label: "Complete the working-style quiz", href: "/quiz", weight: 15, done: !!full.personality },
    { key: "linkedin", label: "Add your LinkedIn", href: "/profile/edit#links", weight: 10, done: !!p.linkedinUrl },
    { key: "commitment", label: "Share your commitment and availability", href: "/profile/edit#goals", weight: 10, done: !!p.commitment && !!p.availability },
    { key: "experience", label: "Add experience", href: "/profile/edit#experience", weight: 10, done: full.experiences.length > 0 },
  ];
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const done = checks.filter((c) => c.done).reduce((s, c) => s + c.weight, 0);
  return {
    percent: Math.round((done / total) * 100),
    missing: checks.filter((c) => !c.done).map(({ key, label, href }) => ({ key, label, href })),
  };
}
