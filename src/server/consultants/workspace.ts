import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  consultantAvailability,
  consultantCategories,
  consultantPortfolioItems,
  consultantProfileCategories,
  consultantProfiles,
  consultantServices,
  consultantTimeOff,
  profiles,
  userRoles,
} from "../db/schema";
import { AppError, notFound } from "../errors";
import { audit } from "../audit";
import { STARTUP_STAGES, PRICING_TYPES } from "@/lib/domain";
import { isValidTimeZone, toLocalDate } from "./tz";

const list = (max: number, itemMax = 60) =>
  z
    .array(z.string().trim().min(1).max(itemMax))
    .max(max)
    .transform((a) => [...new Set(a)]);

export const consultantProfileInput = z.object({
  headline: z.string().trim().min(8, "Write a headline of at least 8 characters.").max(120),
  bio: z.string().trim().max(3000).optional().transform((v) => v || null),
  yearsExperience: z.coerce.number().int().min(0).max(60).nullish(),
  hourlyRateCents: z.coerce.number().int().min(0).max(10_000_000).nullish(),
  languages: list(10, 40).refine((a) => a.length > 0, "Add at least one language."),
  previousCompanies: list(12, 80).default([]),
  stagesServed: z.array(z.enum(STARTUP_STAGES)).max(STARTUP_STAGES.length).default([]),
  categorySlugs: list(5, 80).refine((a) => a.length > 0, "Pick at least one area of expertise."),
  remoteAvailable: z.boolean().default(true),
  acceptingClients: z.boolean().default(true),
});

export const schedulingInput = z.object({
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone."),
  minNoticeHours: z.coerce.number().int().min(0).max(24 * 14),
});

export async function updateScheduling(userId: string, raw: z.input<typeof schedulingInput>) {
  const input = schedulingInput.parse(raw);
  await requireConsultant(userId);
  await db.update(consultantProfiles).set(input).where(eq(consultantProfiles.userId, userId));
}

async function categoryIdsFor(slugs: string[]) {
  if (!slugs.length) return [];
  const rows = await db.select({ id: consultantCategories.id, slug: consultantCategories.slug }).from(consultantCategories).where(and(inArray(consultantCategories.slug, slugs), eq(consultantCategories.active, true)));
  if (rows.length !== slugs.length) throw new AppError("VALIDATION", "One of those categories isn't available.");
  return rows.map((r) => r.id);
}

async function requireConsultant(userId: string) {
  const [c] = await db.select().from(consultantProfiles).where(eq(consultantProfiles.userId, userId)).limit(1);
  if (!c) throw new AppError("VALIDATION", "Set up your consultant profile first.");
  return c;
}

/** Everything the /consultant workspace renders. */
export async function getConsultantWorkspace(userId: string) {
  const [c] = await db.select().from(consultantProfiles).where(eq(consultantProfiles.userId, userId)).limit(1);
  if (!c) return null;
  const today = toLocalDate(new Date(), c.timezone);
  const [cats, services, rules, timeOff, portfolio] = await Promise.all([
    db
      .select({ slug: consultantCategories.slug, name: consultantCategories.name })
      .from(consultantProfileCategories)
      .innerJoin(consultantCategories, eq(consultantCategories.id, consultantProfileCategories.categoryId))
      .where(eq(consultantProfileCategories.consultantId, userId)),
    db.select().from(consultantServices).where(and(eq(consultantServices.consultantId, userId), isNull(consultantServices.deletedAt))).orderBy(asc(consultantServices.sortOrder), asc(consultantServices.createdAt)),
    db.select().from(consultantAvailability).where(eq(consultantAvailability.consultantId, userId)).orderBy(asc(consultantAvailability.weekday), asc(consultantAvailability.startMinute)),
    db.select().from(consultantTimeOff).where(and(eq(consultantTimeOff.consultantId, userId), gte(consultantTimeOff.day, today))).orderBy(asc(consultantTimeOff.day)),
    db.select().from(consultantPortfolioItems).where(eq(consultantPortfolioItems.consultantId, userId)).orderBy(asc(consultantPortfolioItems.sortOrder), asc(consultantPortfolioItems.createdAt)),
  ]);
  return { profile: c, categories: cats, services, rules, timeOff, portfolio };
}

/** Start the consultant application: profile row in `pending_review` + the consultant role. */
export async function becomeConsultant(userId: string, raw: z.input<typeof consultantProfileInput>) {
  const input = consultantProfileInput.parse(raw);
  const [existing] = await db.select({ userId: consultantProfiles.userId }).from(consultantProfiles).where(eq(consultantProfiles.userId, userId)).limit(1);
  if (existing) throw new AppError("CONFLICT", "You already have a consultant profile.");
  const catIds = await categoryIdsFor(input.categorySlugs);
  const [person] = await db.select({ timezone: profiles.timezone }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const timezone = person && isValidTimeZone(person.timezone) ? person.timezone : "UTC";
  await db.transaction(async (tx) => {
    const { categorySlugs: _c, ...fields } = input;
    await tx.insert(consultantProfiles).values({ userId, ...fields, timezone, status: "pending_review" });
    await tx.insert(consultantProfileCategories).values(catIds.map((categoryId) => ({ consultantId: userId, categoryId })));
    await tx.insert(userRoles).values({ userId, role: "consultant" }).onConflictDoNothing();
  });
  await audit({ actorId: userId, action: "consultant.applied", targetType: "consultant", targetId: userId });
}

export async function updateConsultantProfile(userId: string, raw: z.input<typeof consultantProfileInput>) {
  const input = consultantProfileInput.parse(raw);
  const current = await requireConsultant(userId);
  const catIds = await categoryIdsFor(input.categorySlugs);
  await db.transaction(async (tx) => {
    const { categorySlugs: _c, ...fields } = input;
    // A rejected application is re-submitted for review on edit.
    const status = current.status === "rejected" || current.status === "draft" ? "pending_review" : current.status;
    await tx.update(consultantProfiles).set({ ...fields, status }).where(eq(consultantProfiles.userId, userId));
    await tx.delete(consultantProfileCategories).where(eq(consultantProfileCategories.consultantId, userId));
    await tx.insert(consultantProfileCategories).values(catIds.map((categoryId) => ({ consultantId: userId, categoryId })));
  });
}

export const serviceInput = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(3, "Give the service a title.").max(100),
    description: z.string().trim().min(10, "Describe the service in a sentence or two.").max(2000),
    pricingType: z.enum(PRICING_TYPES),
    priceCents: z.coerce.number().int().min(500, "Minimum price is $5.").max(10_000_000),
    durationMinutes: z.coerce.number().int().min(15).max(480),
    billingInterval: z.enum(["week", "month"]).nullish(),
    includes: list(10, 120).default([]),
    categorySlug: z.string().max(80).nullish(),
  })
  .transform((s) => ({ ...s, billingInterval: s.pricingType === "recurring" ? (s.billingInterval ?? "month") : null }));

export async function upsertService(userId: string, raw: z.input<typeof serviceInput>) {
  const input = serviceInput.parse(raw);
  const consultant = await requireConsultant(userId);
  const [categoryId] = input.categorySlug ? await categoryIdsFor([input.categorySlug]) : [null];
  const values = {
    title: input.title,
    description: input.description,
    pricingType: input.pricingType,
    priceCents: input.priceCents,
    currency: consultant.currency,
    durationMinutes: input.durationMinutes,
    billingInterval: input.billingInterval,
    includes: input.includes,
    categoryId: categoryId ?? null,
  };
  if (input.id) {
    const [updated] = await db
      .update(consultantServices)
      .set(values)
      .where(and(eq(consultantServices.id, input.id), eq(consultantServices.consultantId, userId), isNull(consultantServices.deletedAt)))
      .returning();
    if (!updated) throw notFound("That service");
    return updated;
  }
  const [created] = await db.insert(consultantServices).values({ ...values, consultantId: userId }).returning();
  return created!;
}

/** Archive hides a service from clients; past bookings keep their snapshot. */
export async function setServiceActive(userId: string, serviceId: string, active: boolean) {
  const [row] = await db
    .update(consultantServices)
    .set({ active })
    .where(and(eq(consultantServices.id, serviceId), eq(consultantServices.consultantId, userId), isNull(consultantServices.deletedAt)))
    .returning({ id: consultantServices.id });
  if (!row) throw notFound("That service");
}

export const availabilityInput = z.object({
  rules: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1440), endMinute: z.number().int().min(0).max(1440) }))
    .max(50),
});

/** Pure validation: ranges must be positive and must not overlap within a weekday. */
export function validateAvailabilityRules(rules: { weekday: number; startMinute: number; endMinute: number }[]): string | null {
  for (const r of rules) if (r.endMinute <= r.startMinute) return "Each time range must end after it starts.";
  for (let d = 0; d < 7; d++) {
    const day = rules.filter((r) => r.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < day.length; i++) if (day[i]!.startMinute < day[i - 1]!.endMinute) return "Time ranges on the same day can't overlap.";
  }
  return null;
}

export async function setAvailability(userId: string, raw: z.input<typeof availabilityInput>) {
  const { rules } = availabilityInput.parse(raw);
  await requireConsultant(userId);
  const problem = validateAvailabilityRules(rules);
  if (problem) throw new AppError("VALIDATION", problem);
  await db.transaction(async (tx) => {
    await tx.delete(consultantAvailability).where(eq(consultantAvailability.consultantId, userId));
    if (rules.length) await tx.insert(consultantAvailability).values(rules.map((r) => ({ ...r, consultantId: userId })));
  });
}

export const timeOffInput = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.") });

export async function addTimeOff(userId: string, raw: z.input<typeof timeOffInput>) {
  const { day } = timeOffInput.parse(raw);
  const c = await requireConsultant(userId);
  if (day < toLocalDate(new Date(), c.timezone)) throw new AppError("VALIDATION", "Pick today or a future date.");
  await db.insert(consultantTimeOff).values({ consultantId: userId, day }).onConflictDoNothing();
}

export async function removeTimeOff(userId: string, id: string) {
  await db.delete(consultantTimeOff).where(and(eq(consultantTimeOff.id, id), eq(consultantTimeOff.consultantId, userId)));
}

export const portfolioInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^https?:\/\//i.test(v), "Links must start with http:// or https://"),
});

export async function addPortfolioItem(userId: string, raw: z.input<typeof portfolioInput>) {
  const input = portfolioInput.parse(raw);
  await requireConsultant(userId);
  const [row] = await db.insert(consultantPortfolioItems).values({ ...input, consultantId: userId }).returning();
  return row!;
}

export async function removePortfolioItem(userId: string, id: string) {
  await db.delete(consultantPortfolioItems).where(and(eq(consultantPortfolioItems.id, id), eq(consultantPortfolioItems.consultantId, userId)));
}

/** Defaults for the application form, from the person's profile. */
export async function getApplicationDefaults(userId: string) {
  const [p] = await db.select({ headline: profiles.headline, bio: profiles.bio, timezone: profiles.timezone, yearsExperience: profiles.yearsExperience }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return p ?? null;
}
