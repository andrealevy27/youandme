import { eq, sql, type SQL } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { db } from "../db";
import { profiles } from "../db/schema";
import { adminBootstrapEmails, env } from "../env";
import { SCHOOL_LIST_TEXT, schoolBySlug, schoolForEmail } from "@/lib/schools";

export const CAMPUS_SCOPES = ["all", "my_school"] as const;
export type CampusScope = (typeof CAMPUS_SCOPES)[number];

/**
 * Student mode sign-up rule: only accepted school emails. Founders/organizers listed in
 * ADMIN_EMAILS are exempt so they can run the platform from their own address.
 */
export function assertStudentSignupAllowed(email: string | undefined | null) {
  if (!env.STUDENT_MODE) return;
  const e = (email ?? "").trim().toLowerCase();
  if (adminBootstrapEmails.includes(e)) return;
  if (!schoolForEmail(e)) {
    throw new APIError("FORBIDDEN", {
      message: `FoundMate is for students right now. Sign up with your school email (${SCHOOL_LIST_TEXT}).`,
    });
  }
}

/** On account creation: record which school the email belongs to (not yet verified). */
export async function initStudentProfile(userId: string, email: string) {
  if (!env.STUDENT_MODE) return;
  const school = schoolForEmail(email);
  // Opt-in visibility: hidden until the student chooses to be seen during onboarding.
  await db
    .update(profiles)
    .set({ school: school?.slug ?? null, university: school?.name ?? null, visibility: "hidden" })
    .where(eq(profiles.userId, userId));
}

/** Called when the account email is confirmed. A confirmed school email = a verified student. */
export async function markSchoolVerified(userId: string, email: string) {
  const school = schoolForEmail(email);
  if (!school) return;
  await db
    .update(profiles)
    .set({ school: school.slug, university: school.name, schoolVerifiedAt: sql`coalesce(${profiles.schoolVerifiedAt}, now())` })
    .where(eq(profiles.userId, userId));
}

export type StudentStatus = {
  school: { slug: string; name: string; shortName: string } | null;
  verified: boolean;
  campusScope: CampusScope;
  visible: boolean;
};

export async function getStudentStatus(userId: string): Promise<StudentStatus> {
  const [p] = await db
    .select({ school: profiles.school, verifiedAt: profiles.schoolVerifiedAt, campusScope: profiles.campusScope, visibility: profiles.visibility })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const school = schoolBySlug(p?.school);
  return {
    school: school ? { slug: school.slug, name: school.name, shortName: school.shortName } : null,
    verified: !!p?.verifiedAt,
    campusScope: (p?.campusScope as CampusScope) ?? "all",
    visible: p?.visibility === "public",
  };
}

const prefsSchema = z.object({ campusScope: z.enum(CAMPUS_SCOPES).optional(), visible: z.boolean().optional() });

export async function updateStudentPrefs(userId: string, raw: z.input<typeof prefsSchema>) {
  const input = prefsSchema.parse(raw);
  const patch: Partial<typeof profiles.$inferInsert> = {};
  if (input.campusScope) patch.campusScope = input.campusScope;
  if (input.visible !== undefined) patch.visibility = input.visible ? "public" : "hidden";
  if (Object.keys(patch).length) await db.update(profiles).set(patch).where(eq(profiles.userId, userId));
  return getStudentStatus(userId);
}

/**
 * SQL on `profiles` (the candidate): only verified students, and campus scope respected in both
 * directions — if either person chose "my school only", they only see each other at the same school.
 */
export function studentVisibilityCondition(viewerId?: string): SQL | undefined {
  if (!env.STUDENT_MODE) return undefined;
  const verified = sql`${profiles.schoolVerifiedAt} is not null`;
  if (!viewerId) return verified;
  const viewerSchool = sql`(select vp.school from profiles vp where vp.user_id = ${viewerId})`;
  const viewerScope = sql`(select vp.campus_scope from profiles vp where vp.user_id = ${viewerId})`;
  return sql`(${verified} and (${profiles.campusScope} = 'all' or ${profiles.school} = ${viewerSchool}) and (${viewerScope} = 'all' or ${profiles.school} = ${viewerSchool}))`;
}

/** Can this viewer see other students at all? Verified students and FoundMate admins only. */
export async function canSeeStudents(viewer: { userId: string; adminRole: string | null }): Promise<boolean> {
  if (!env.STUDENT_MODE || viewer.adminRole) return true;
  return (await getStudentStatus(viewer.userId)).verified;
}
