import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireViewerPage } from "@/server/auth/session";
import { getStartupBySlug } from "@/server/startups";
import { canOnStartup } from "@/server/authz/startup";
import { getTaxonomy } from "@/server/people/profile";
import { StartupForm } from "@/components/startups/startup-form";
import { DeleteStartupButton } from "@/components/startups/delete-startup";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Edit startup" };

export default async function EditStartupPage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireViewerPage();
  const { slug } = await params;
  const data = await getStartupBySlug(viewer.userId, slug);
  if (!data) notFound();
  if (!canOnStartup(data.membership, "edit")) redirect(`/startups/${slug}`);
  const s = data.startup;
  const { industries } = await getTaxonomy();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${s.name}`} />
      <StartupForm
        mode="edit"
        startupId={s.id}
        slug={s.slug}
        industries={industries.map((i) => ({ id: i.id, name: i.name }))}
        initial={{
          name: s.name,
          tagline: s.tagline ?? "",
          description: s.description ?? "",
          problem: s.problem ?? "",
          solution: s.solution ?? "",
          stage: s.stage,
          businessModel: s.businessModel ?? "",
          foundedOn: s.foundedOn ?? "",
          location: s.location ?? "",
          workMode: s.workMode ?? "",
          websiteUrl: s.websiteUrl ?? "",
          pitchDeckUrl: s.pitchDeckUrl ?? "",
          logoUrl: s.logoUrl ?? "",
          traction: s.traction ?? "",
          fundingStatus: s.fundingStatus ?? "",
          fundingRaised: s.fundingRaisedCents ? String(s.fundingRaisedCents / 100) : "",
          teamSize: s.teamSize ? String(s.teamSize) : "",
          status: s.status as "active",
          visibility: s.visibility === "hidden" ? "hidden" : "public",
          industryIds: data.industries.map((i) => i.id),
        }}
      />
      {data.membership?.role === "founder" && (
        <div className="mt-10 rounded-[16px] border border-danger/30 p-5">
          <h2 className="text-sm font-semibold text-danger">Delete startup</h2>
          <p className="mt-1 text-sm text-muted">Removes the startup profile for everyone. Team members keep their accounts.</p>
          <DeleteStartupButton startupId={s.id} name={s.name} />
        </div>
      )}
    </div>
  );
}
