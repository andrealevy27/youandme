import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireViewerPage } from "@/server/auth/session";
import { db } from "@/server/db";
import { consultantCategories, profiles, userIndustries, userSkills } from "@/server/db/schema";
import { getTaxonomy } from "@/server/people/profile";
import { getPrimaryStartup } from "@/server/startups";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { StudentOnboardingFlow } from "@/components/student/student-onboarding";
import { env } from "@/server/env";
import { getStudentStatus } from "@/server/student";
import { inArray } from "drizzle-orm";
import { personalityAnswers, personalityQuestions } from "@/server/db/schema";
import { SHORT_QUIZ_KEYS } from "@/lib/student";
import type { CofounderType } from "@/lib/domain";

/** Only same-site relative paths, so `?next=` can't redirect off-site. */
function safeNext(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.startsWith("/") && !s.startsWith("//") ? s : "/home";
}

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewerPage({ onboarded: false });
  const next = safeNext((await searchParams).next);
  if (viewer.onboarded) redirect(next);
  if (env.STUDENT_MODE) return <StudentOnboarding userId={viewer.userId} next={next} />;
  const [[profile], taxonomy, categories, mySkills, myIndustries, startup] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, viewer.userId)),
    getTaxonomy(),
    db.select({ id: consultantCategories.id, name: consultantCategories.name, description: consultantCategories.description }).from(consultantCategories).where(eq(consultantCategories.active, true)).orderBy(asc(consultantCategories.sortOrder)),
    db.select({ id: userSkills.skillId }).from(userSkills).where(eq(userSkills.userId, viewer.userId)),
    db.select({ id: userIndustries.industryId }).from(userIndustries).where(eq(userIndustries.userId, viewer.userId)),
    getPrimaryStartup(viewer.userId),
  ]);
  if (!profile) redirect("/login");
  return (
    <OnboardingFlow
      initial={{
        stepIndex: profile.onboardingStep,
        displayName: profile.displayName,
        headline: profile.headline ?? "",
        intents: profile.intents as never,
        city: profile.city ?? "",
        country: profile.country ?? "",
        currentRole: profile.currentRole ?? "",
        currentCompany: profile.currentCompany ?? "",
        university: profile.university ?? "",
        yearsExperience: profile.yearsExperience,
        skillIds: mySkills.map((s) => s.id),
        industryIds: myIndustries.map((i) => i.id),
        hasStartup: startup ? "yes" : null,
        startup: startup
          ? { name: startup.startup.name, tagline: startup.startup.tagline ?? "", stage: startup.startup.stage, teamSize: startup.startup.teamSize ?? 1 }
          : { name: "", tagline: "", stage: null, teamSize: 1 },
        lookingForCofounder: profile.lookingForCofounder,
        cofounderTypes: profile.cofounderTypes as never,
        commitment: profile.commitment,
        availability: profile.availability,
        workMode: profile.workMode,
        stagePreferences: profile.stagePreferences as never,
        ambition: profile.ambition,
        founderExperience: profile.founderExperience,
        equityExpectation: profile.equityExpectation ?? "",
        lookingFor: profile.lookingFor ?? "",
      }}
      skills={taxonomy.skills.map((s) => ({ id: s.id, name: s.name, category: s.category }))}
      industries={taxonomy.industries.map((i) => ({ id: i.id, name: i.name }))}
      categories={categories}
    />
  );
}

async function StudentOnboarding({ userId, next }: { userId: string; next: string }) {
  const [[profile], taxonomy, mySkills, myIndustries, status, quiz] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)),
    getTaxonomy(),
    db.select({ id: userSkills.skillId }).from(userSkills).where(eq(userSkills.userId, userId)),
    db.select({ id: userIndustries.industryId }).from(userIndustries).where(eq(userIndustries.userId, userId)),
    getStudentStatus(userId),
    db.select({ id: personalityQuestions.id, key: personalityQuestions.key, prompt: personalityQuestions.prompt }).from(personalityQuestions).where(inArray(personalityQuestions.key, [...SHORT_QUIZ_KEYS])),
  ]);
  if (!profile) redirect("/login");
  const answers = quiz.length
    ? await db.select().from(personalityAnswers).where(eq(personalityAnswers.userId, userId))
    : [];
  const keyById = new Map(quiz.map((q) => [q.id, q.key]));
  const ordered = SHORT_QUIZ_KEYS.map((k) => quiz.find((q) => q.key === k)).filter((q): q is NonNullable<typeof q> => !!q);
  return (
    <StudentOnboardingFlow
      next={next}
      school={status.school ? { name: status.school.name, verified: status.verified } : null}
      initial={{
        stepIndex: profile.onboardingStep,
        displayName: profile.displayName,
        classYear: profile.classYear ?? "",
        major: profile.major ?? "",
        skillIds: mySkills.map((s) => s.id),
        ideaStatus: profile.ideaStatus ?? "",
        ideaSummary: profile.ideaSummary ?? "",
        cofounderTypes: profile.cofounderTypes as CofounderType[],
        lookingFor: profile.lookingFor ?? "",
        industryIds: myIndustries.map((i) => i.id),
        weeklyHours: profile.weeklyHours,
        summerPlans: profile.summerPlans ?? "",
        answers: Object.fromEntries(answers.filter((a) => keyById.has(a.questionId)).map((a) => [keyById.get(a.questionId)!, a.value])),
        visible: true,
        campusScope: status.campusScope,
      }}
      skills={taxonomy.skills.map((s) => ({ id: s.id, name: s.name, category: s.category }))}
      industries={taxonomy.industries.map((i) => ({ id: i.id, name: i.name }))}
      quiz={ordered.map((q) => ({ key: q.key, prompt: q.prompt }))}
    />
  );
}
