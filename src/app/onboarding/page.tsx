import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireViewerPage } from "@/server/auth/session";
import { db } from "@/server/db";
import { consultantCategories, profiles, userIndustries, userSkills } from "@/server/db/schema";
import { getTaxonomy } from "@/server/people/profile";
import { getPrimaryStartup } from "@/server/startups";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const viewer = await requireViewerPage({ onboarded: false });
  if (viewer.onboarded) redirect("/home");
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
