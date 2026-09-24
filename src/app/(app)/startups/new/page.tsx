import type { Metadata } from "next";
import { requireViewerPage } from "@/server/auth/session";
import { getTaxonomy } from "@/server/people/profile";
import { StartupForm, EMPTY_STARTUP } from "@/components/startups/startup-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Create startup" };

export default async function NewStartupPage() {
  await requireViewerPage();
  const { industries } = await getTaxonomy();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Your startup" title="Build the team behind the idea." description="A clear startup profile helps the right cofounders, talent and consultants find you." />
      <StartupForm mode="create" initial={EMPTY_STARTUP} industries={industries.map((i) => ({ id: i.id, name: i.name }))} />
    </div>
  );
}
