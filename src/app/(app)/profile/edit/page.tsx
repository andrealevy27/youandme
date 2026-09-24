import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requireViewerPage } from "@/server/auth/session";
import { getFullProfile } from "@/server/people";
import { getTaxonomy } from "@/server/people/profile";
import { db } from "@/server/db";
import { userIndustries } from "@/server/db/schema";
import { ProfileEditor } from "@/components/people/profile-editor";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const viewer = await requireViewerPage();
  const [full, taxonomy, industryRows] = await Promise.all([
    getFullProfile(viewer.userId, viewer.userId),
    getTaxonomy(),
    db.select({ id: userIndustries.industryId }).from(userIndustries).where(eq(userIndustries.userId, viewer.userId)),
  ]);
  if (!full) return null;
  const p = full.profile;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit profile" description="Everything here shapes who you're matched with. Be specific." />
      <ProfileEditor
        profile={{
          handle: p.handle,
          displayName: p.displayName,
          headline: p.headline ?? "",
          bio: p.bio ?? "",
          avatarUrl: p.avatarUrl,
          city: p.city ?? "",
          country: p.country ?? "",
          timezone: p.timezone,
          university: p.university ?? "",
          currentRole: p.currentRole ?? "",
          currentCompany: p.currentCompany ?? "",
          yearsExperience: p.yearsExperience,
          linkedinUrl: p.linkedinUrl ?? "",
          websiteUrl: p.websiteUrl ?? "",
          githubUrl: p.githubUrl ?? "",
          portfolioUrl: p.portfolioUrl ?? "",
          commitment: p.commitment,
          availability: p.availability,
          workMode: p.workMode,
          ambition: p.ambition,
          founderExperience: p.founderExperience,
          lookingForCofounder: p.lookingForCofounder,
          cofounderTypes: p.cofounderTypes as never,
          stagePreferences: p.stagePreferences as never,
          lookingFor: p.lookingFor ?? "",
          equityExpectation: p.equityExpectation ?? "",
          intents: p.intents as never,
        }}
        skillIds={full.skills.map((s) => s.id)}
        industryIds={industryRows.map((i) => i.id)}
        experiences={full.experiences.map((e) => ({ id: e.id, title: e.title, company: e.company, startYear: e.startYear, endYear: e.endYear, isCurrent: e.isCurrent }))}
        educations={full.educations.map((e) => ({ id: e.id, school: e.school, degree: e.degree, field: e.field, endYear: e.endYear }))}
        skills={taxonomy.skills.map((s) => ({ id: s.id, name: s.name, category: s.category }))}
        industries={taxonomy.industries.map((i) => ({ id: i.id, name: i.name }))}
      />
    </div>
  );
}
