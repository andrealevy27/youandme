import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pgClient } from "../index";
import * as s from "../schema";
import { QUIZ_QUESTIONS, QUIZ_VERSION, scoreQuiz, type DimensionKey } from "@/lib/personality";
import { onUserCreated } from "@/server/auth/lifecycle";
import { slugify } from "@/lib/slug";
import { CONSULTANT_CATEGORIES, INDUSTRIES, SKILLS } from "./reference";
import { DEMO_CONSULTANTS, DEMO_DOMAIN, DEMO_PASSWORD, DEMO_PEOPLE, DEMO_STARTUPS, type DemoPerson } from "./demo";

export async function seedReference() {
  await db.insert(s.skills).values(SKILLS).onConflictDoNothing();
  await db.insert(s.industries).values(INDUSTRIES).onConflictDoNothing();
  await db
    .insert(s.consultantCategories)
    .values(CONSULTANT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
    .onConflictDoNothing();
  await db
    .insert(s.personalityQuestions)
    .values(QUIZ_QUESTIONS.map((q, i) => ({ ...q, order: i, version: QUIZ_VERSION })))
    .onConflictDoUpdate({
      target: s.personalityQuestions.key,
      set: { prompt: sql`excluded.prompt`, dimension: sql`excluded.dimension`, polarity: sql`excluded.polarity`, order: sql`excluded.order`, topic: sql`excluded.topic` },
    });
}

/** Turn target dimension scores into Likert answers that reproduce them (for demo quiz data). */
function answersFor(target: Partial<Record<DimensionKey, number>>) {
  const answers: Record<string, number> = {};
  for (const q of QUIZ_QUESTIONS) {
    const t = (target[q.dimension] ?? 0) / 100;
    answers[q.key] = Math.max(1, Math.min(5, Math.round(3 + 2 * t * q.polarity)));
  }
  return answers;
}

async function createDemoUser(p: DemoPerson, passwordHash: string) {
  const email = `${p.key}@${DEMO_DOMAIN}`;
  const [existing] = await db.select().from(s.user).where(eq(s.user.email, email)).limit(1);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.insert(s.user).values({ id, name: p.name, email, emailVerified: true });
  await db.insert(s.account).values({ id: crypto.randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
  await onUserCreated({ id, name: p.name, email });

  const skillRows = await db.select().from(s.skills).where(inArray(s.skills.slug, p.skills.map(([slug]) => slug)));
  const industryRows = await db.select().from(s.industries).where(inArray(s.industries.name, p.industries));
  await db
    .update(s.profiles)
    .set({
      handle: slugify(p.name),
      headline: p.headline,
      bio: p.bio,
      city: p.city,
      country: p.country,
      location: `${p.city}, ${p.country}`,
      timezone: p.timezone,
      university: p.university ?? null,
      currentRole: p.currentRole ?? null,
      currentCompany: p.currentCompany ?? null,
      intents: p.intents,
      lookingForCofounder: p.lookingForCofounder ?? false,
      cofounderTypes: p.cofounderTypes ?? [],
      stagePreferences: p.stages ?? [],
      commitment: p.commitment ?? null,
      availability: p.availability ?? null,
      workMode: p.workMode ?? null,
      ambition: p.ambition ?? null,
      founderExperience: p.founderExperience ?? null,
      yearsExperience: p.years ?? null,
      lookingFor: p.lookingFor ?? null,
      linkedinUrl: p.linkedin ? `https://www.linkedin.com/in/demo-${p.key}` : null,
      isDemo: true,
      onboardingCompletedAt: new Date(),
      lastActiveAt: new Date(Date.now() - Math.floor(Math.random() * 5) * 86_400_000),
    })
    .where(eq(s.profiles.userId, id));
  if (p.roles.length) await db.insert(s.userRoles).values(p.roles.map((role) => ({ userId: id, role }))).onConflictDoNothing();
  if (skillRows.length) {
    await db.insert(s.userSkills).values(
      skillRows.map((sk, i) => ({ userId: id, skillId: sk.id, level: p.skills.find(([slug]) => slug === sk.slug)?.[1] ?? 2, isPrimary: i < 2 })),
    );
  }
  if (industryRows.length) await db.insert(s.userIndustries).values(industryRows.map((ind) => ({ userId: id, industryId: ind.id })));
  for (const e of p.experience ?? []) {
    await db.insert(s.experiences).values({ userId: id, title: e.title, company: e.company, startYear: e.start, endYear: e.end ?? null, isCurrent: !e.end });
  }
  if (p.university) await db.insert(s.educations).values({ userId: id, school: p.university });
  if (p.personality) {
    const questions = await db.select().from(s.personalityQuestions);
    const answers = answersFor(p.personality);
    await db.insert(s.personalityAnswers).values(questions.map((q) => ({ userId: id, questionId: q.id, value: answers[q.key] ?? 3 })));
    await db.insert(s.personalityProfiles).values({ userId: id, scores: scoreQuiz(answers), version: QUIZ_VERSION });
  }
  await db.insert(s.identityVerifications).values({ userId: id, type: "email", status: "verified", verifiedAt: new Date(), subject: email });
  return id;
}

export async function seedDemo() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids = new Map<string, string>();

  for (const p of DEMO_PEOPLE) ids.set(p.key, await createDemoUser(p, passwordHash));

  const categories = await db.select().from(s.consultantCategories);
  const catId = (slug: string) => categories.find((c) => c.slug === slug)?.id ?? null;
  for (const c of DEMO_CONSULTANTS) {
    const id = await createDemoUser(c, passwordHash);
    ids.set(c.key, id);
    const [exists] = await db.select().from(s.consultantProfiles).where(eq(s.consultantProfiles.userId, id)).limit(1);
    if (exists) continue;
    await db.insert(s.consultantProfiles).values({
      userId: id,
      headline: c.consultant.headline,
      bio: c.bio,
      yearsExperience: c.years ?? null,
      hourlyRateCents: c.consultant.hourlyRateCents,
      languages: c.consultant.languages,
      previousCompanies: c.consultant.previousCompanies,
      stagesServed: c.consultant.stagesServed,
      timezone: c.timezone,
      status: "approved",
    });
    await db.insert(s.consultantProfileCategories).values(c.consultant.categories.map((slug) => ({ consultantId: id, categoryId: catId(slug)! })));
    await db.insert(s.consultantServices).values(
      c.consultant.services.map((sv, i) => ({
        consultantId: id,
        categoryId: catId(sv.category),
        title: sv.title,
        description: sv.description,
        pricingType: sv.pricingType,
        priceCents: sv.priceCents,
        durationMinutes: sv.durationMinutes,
        includes: sv.includes,
        billingInterval: sv.billingInterval ?? null,
        sortOrder: i,
      })),
    );
    await db.insert(s.consultantAvailability).values(
      Object.entries(c.consultant.hours).map(([weekday, [start, end]]) => ({
        consultantId: id,
        weekday: Number(weekday),
        startMinute: start * 60,
        endMinute: end * 60,
      })),
    );
    for (const item of c.consultant.portfolio ?? []) await db.insert(s.consultantPortfolioItems).values({ consultantId: id, ...item });
  }

  const skills = await db.select().from(s.skills);
  const industries = await db.select().from(s.industries);
  for (const st of DEMO_STARTUPS) {
    const slug = slugify(st.name);
    const [exists] = await db.select().from(s.startups).where(eq(s.startups.slug, slug)).limit(1);
    if (exists) continue;
    const founderId = ids.get(st.members[0]!.person)!;
    const [startup] = await db
      .insert(s.startups)
      .values({
        slug,
        name: st.name,
        tagline: st.tagline,
        description: st.description,
        problem: st.problem,
        solution: st.solution,
        stage: st.stage,
        businessModel: st.businessModel,
        location: st.location,
        workMode: st.workMode,
        fundingStatus: st.fundingStatus,
        traction: st.traction ?? null,
        teamSize: st.members.length,
        createdById: founderId,
        isDemo: true,
      })
      .returning();
    await db.insert(s.startupIndustries).values(
      industries.filter((i) => st.industries.includes(i.name)).map((i) => ({ startupId: startup!.id, industryId: i.id })),
    );
    for (const m of st.members) {
      await db.insert(s.startupMembers).values({ startupId: startup!.id, userId: ids.get(m.person)!, role: m.role, title: m.title, isAdmin: !!m.isAdmin });
    }
    for (const n of st.needs) {
      const [need] = await db
        .insert(s.needs)
        .values({ ownerId: founderId, startupId: startup!.id, type: n.type, title: n.title, description: n.description, consultantCategoryId: n.category ? catId(n.category) : null })
        .returning();
      const needSkillIds = skills.filter((sk) => n.skills?.includes(sk.slug)).map((sk) => ({ needId: need!.id, skillId: sk.id }));
      if (needSkillIds.length) await db.insert(s.needSkills).values(needSkillIds);
    }
    for (const r of st.openRoles ?? []) await db.insert(s.openRoles).values({ startupId: startup!.id, ...r });
  }

  // Demo admin account (granted super_admin through ADMIN_EMAILS in .env).
  await createDemoUser(
    { key: "admin", name: "You&Me Admin", headline: "Platform administrator", bio: "Demo administrator account.", city: "New York", country: "United States", timezone: "America/New_York", roles: [], intents: ["exploring"], skills: [], industries: [] },
    passwordHash,
  );
  await db.update(s.profiles).set({ visibility: "hidden" }).where(and(eq(s.profiles.handle, "you-me-admin")));
}

async function main() {
  await seedReference();
  console.log("Reference data seeded.");
  if (process.env.NODE_ENV !== "production" && !process.argv.includes("--reference-only")) {
    await seedDemo();
    console.log(`Demo data seeded. Sign in as lisa@${DEMO_DOMAIN} / ${DEMO_PASSWORD} (admin: admin@${DEMO_DOMAIN}).`);
  }
  await new Promise((r) => setTimeout(r, 300));
  await pgClient.end();
}

if (process.argv[1]?.endsWith("seed/index.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
