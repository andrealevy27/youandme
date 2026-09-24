import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  educations,
  experiences,
  industries,
  profiles,
  skills,
  userIndustries,
  userRoles,
  userSkills,
  user as userTable,
} from "../db/schema";
import { AppError } from "../errors";
import { track } from "../analytics";
import {
  AMBITIONS,
  AVAILABILITY,
  COFOUNDER_TYPES,
  COMMITMENTS,
  FOUNDER_EXPERIENCE,
  INTENTS,
  INTENT_TO_ROLES,
  STARTUP_STAGES,
  USER_ROLES,
  VISIBILITY,
  WORK_MODES,
} from "@/lib/domain";
import { safeUrl } from "@/lib/utils";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v, ctx) => {
    if (v === "") return null;
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const ok = safeUrl(withProto);
    if (!ok) {
      ctx.addIssue({ code: "custom", message: "Enter a valid link." });
      return z.NEVER;
    }
    return ok;
  })
  .nullable()
  .optional();

export const profilePatchSchema = z.object({
  displayName: z.string().trim().min(1, "Add your name.").max(80).optional(),
  headline: optionalText(120),
  bio: optionalText(1200),
  avatarUrl: z.string().max(500).nullable().optional(),
  city: optionalText(80),
  country: optionalText(80),
  timezone: z
    .string()
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone")
    .optional(),
  university: optionalText(120),
  currentRole: optionalText(100),
  currentCompany: optionalText(100),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
  githubUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  intents: z.array(z.enum(INTENTS)).max(INTENTS.length).optional(),
  availability: z.enum(AVAILABILITY).nullable().optional(),
  commitment: z.enum(COMMITMENTS).nullable().optional(),
  workMode: z.enum(WORK_MODES).nullable().optional(),
  ambition: z.enum(AMBITIONS).nullable().optional(),
  founderExperience: z.enum(FOUNDER_EXPERIENCE).nullable().optional(),
  lookingForCofounder: z.boolean().optional(),
  cofounderTypes: z.array(z.enum(COFOUNDER_TYPES)).max(COFOUNDER_TYPES.length).optional(),
  stagePreferences: z.array(z.enum(STARTUP_STAGES)).max(STARTUP_STAGES.length).optional(),
  equityExpectation: optionalText(200),
  lookingFor: optionalText(500),
  goals: optionalText(500),
  visibility: z.enum(VISIBILITY).optional(),
});
export type ProfilePatch = z.input<typeof profilePatchSchema>;

export async function updateProfile(userId: string, raw: ProfilePatch) {
  const patch = profilePatchSchema.parse(raw);
  const values: Partial<typeof profiles.$inferInsert> = { ...patch };
  if (patch.city !== undefined || patch.country !== undefined) {
    const [current] = await db.select({ city: profiles.city, country: profiles.country }).from(profiles).where(eq(profiles.userId, userId));
    const city = patch.city !== undefined ? patch.city : current?.city;
    const country = patch.country !== undefined ? patch.country : current?.country;
    values.location = [city, country].filter(Boolean).join(", ") || null;
  }
  if (Object.keys(values).length) await db.update(profiles).set(values).where(eq(profiles.userId, userId));
  if (patch.displayName) await db.update(userTable).set({ name: patch.displayName }).where(eq(userTable.id, userId));
  if (patch.intents) await syncRolesFromIntents(userId, patch.intents);
}

/** Roles derived from intents are added; roles granted elsewhere (e.g. approved consultant) are preserved. */
async function syncRolesFromIntents(userId: string, intents: (typeof INTENTS)[number][]) {
  const derived = new Set(intents.flatMap((i) => INTENT_TO_ROLES[i]));
  const managed = USER_ROLES.filter((r) => r !== "consultant");
  await db.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.role, managed), derived.size ? notInArray(userRoles.role, [...derived]) : undefined));
  if (derived.size) {
    await db
      .insert(userRoles)
      .values([...derived].filter((r) => r !== "consultant").map((role) => ({ userId, role })))
      .onConflictDoNothing();
  }
}

export async function setUserSkills(userId: string, skillIds: string[], primaryIds: string[] = []) {
  const ids = [...new Set(skillIds)].slice(0, 15);
  const valid = ids.length ? await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, ids)) : [];
  await db.transaction(async (tx) => {
    await tx.delete(userSkills).where(eq(userSkills.userId, userId));
    if (valid.length) {
      await tx.insert(userSkills).values(valid.map((s) => ({ userId, skillId: s.id, isPrimary: primaryIds.includes(s.id), level: 2 })));
    }
  });
}

export async function setUserIndustries(userId: string, industryIds: string[]) {
  const ids = [...new Set(industryIds)].slice(0, 8);
  const valid = ids.length ? await db.select({ id: industries.id }).from(industries).where(inArray(industries.id, ids)) : [];
  await db.transaction(async (tx) => {
    await tx.delete(userIndustries).where(eq(userIndustries.userId, userId));
    if (valid.length) await tx.insert(userIndustries).values(valid.map((i) => ({ userId, industryId: i.id })));
  });
}

export const experienceSchema = z.object({
  title: z.string().trim().min(1).max(100),
  company: z.string().trim().min(1).max(100),
  description: optionalText(600),
  startYear: z.number().int().min(1950).max(2100).nullable().optional(),
  endYear: z.number().int().min(1950).max(2100).nullable().optional(),
  isCurrent: z.boolean().default(false),
});

export async function addExperience(userId: string, raw: z.input<typeof experienceSchema>) {
  const data = experienceSchema.parse(raw);
  if (data.startYear && data.endYear && data.endYear < data.startYear) throw new AppError("VALIDATION", "End year must be after start year.");
  await db.insert(experiences).values({ userId, ...data });
}

export async function removeExperience(userId: string, id: string) {
  await db.delete(experiences).where(and(eq(experiences.id, id), eq(experiences.userId, userId)));
}

export const educationSchema = z.object({
  school: z.string().trim().min(1).max(120),
  degree: optionalText(100),
  field: optionalText(100),
  endYear: z.number().int().min(1950).max(2100).nullable().optional(),
});

export async function addEducation(userId: string, raw: z.input<typeof educationSchema>) {
  await db.insert(educations).values({ userId, ...educationSchema.parse(raw) });
}

export async function removeEducation(userId: string, id: string) {
  await db.delete(educations).where(and(eq(educations.id, id), eq(educations.userId, userId)));
}

export async function setOnboardingStep(userId: string, step: number) {
  await db.update(profiles).set({ onboardingStep: step }).where(eq(profiles.userId, userId));
}

export async function completeOnboarding(userId: string) {
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!p) throw new AppError("NOT_FOUND", "Profile not found.");
  if (!p.displayName.trim()) throw new AppError("VALIDATION", "Add your name to finish.");
  if (!p.onboardingCompletedAt) {
    await db.update(profiles).set({ onboardingCompletedAt: new Date() }).where(eq(profiles.userId, userId));
    track("profile_completed", userId, { intents: p.intents.join(",") });
  }
}

export async function isHandleAvailable(handle: string, userId: string) {
  const [row] = await db
    .select({ id: profiles.userId })
    .from(profiles)
    .where(sql`lower(${profiles.handle}) = ${handle.toLowerCase()}`)
    .limit(1);
  return !row || row.id === userId;
}

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/, "Use 3–30 letters, numbers or dashes.");

export async function updateHandle(userId: string, raw: string) {
  const handle = handleSchema.parse(raw);
  if (!(await isHandleAvailable(handle, userId))) throw new AppError("CONFLICT", "That handle is taken.");
  await db.update(profiles).set({ handle }).where(eq(profiles.userId, userId));
}

/** Taxonomy for pickers. Small tables — safe to load whole. */
export async function getTaxonomy() {
  const [skillRows, industryRows] = await Promise.all([
    db.select().from(skills).orderBy(skills.category, skills.name),
    db.select().from(industries).orderBy(industries.name),
  ]);
  return { skills: skillRows, industries: industryRows };
}
