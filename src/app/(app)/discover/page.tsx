import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ConsultantsCta } from "@/components/discover/consultants-cta";
import { DiscoverControls } from "@/components/discover/discover-controls";
import { ResultsList } from "@/components/discover/results-list";
import { ResultsSkeleton } from "@/components/discover/results-skeleton";
import { isDiscoverTab, type DiscoverTab } from "@/components/discover/config";
import { requireViewerPage } from "@/server/auth/session";
import { listIndustries, peopleFiltersSchema, searchPeople, searchStartups, searchStartupsSchema } from "@/server/search";

export const metadata: Metadata = { title: "Discover" };

type SP = Record<string, string | string[] | undefined>;
const PAGE_SIZE = 12;

function pick(sp: SP, keys: string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s && s.length <= 200) out[k] = s;
  }
  return out;
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireViewerPage();
  const sp = await searchParams;
  const params = pick(sp, ["q", "tab", "cat", "industry", "commitment", "availability", "location", "stage", "lookingFor"]);
  const tab: DiscoverTab = isDiscoverTab(params.tab) ? params.tab : "people";
  const industries = await listIndustries();

  return (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="Find the people you need"
        description="Search cofounders, founders, talent and startups by what they do, what they care about and where they studied."
      />
      <DiscoverControls tab={tab} params={params} industries={industries.map(({ slug, name }) => ({ slug, name }))} />
      <div className="mt-6">
        {tab === "consultants" ? (
          <ConsultantsCta q={params.q ?? ""} />
        ) : (
          <Suspense key={JSON.stringify(params)} fallback={<ResultsSkeleton />}>
            <Results tab={tab} params={params} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

async function Results({ tab, params }: { tab: Exclude<DiscoverTab, "consultants">; params: Record<string, string> }) {
  const viewer = await requireViewerPage();
  const clearHref = `/discover?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(tab !== "people" ? { tab } : {}) })}`;

  if (tab === "startups") {
    // Invalid filter values from a hand-edited URL are ignored rather than erroring.
    const parsed = searchStartupsSchema.safeParse({ q: params.q, stage: params.stage, industry: params.industry, lookingFor: params.lookingFor, limit: PAGE_SIZE });
    const input = parsed.success ? parsed.data : searchStartupsSchema.parse({ q: params.q, limit: PAGE_SIZE });
    const page = await searchStartups(viewer.userId, input);
    const api = new URLSearchParams({ type: "startups", limit: String(PAGE_SIZE) });
    if (input.q) api.set("q", input.q);
    if (input.stage) api.set("stage", input.stage);
    if (input.industry) api.set("industry", input.industry);
    if (input.lookingFor) api.set("lookingFor", input.lookingFor);
    return <ResultsList kind="startups" initialItems={page.items} initialCursor={page.nextCursor} apiQuery={api.toString()} clearHref={clearHref} />;
  }

  const parsedFilters = peopleFiltersSchema.safeParse({
    skillCategories: params.cat,
    industries: params.industry,
    commitment: params.commitment,
    availability: params.availability,
    location: params.location,
    stage: params.stage,
  });
  const filters = parsedFilters.success ? parsedFilters.data : {};
  const page = await searchPeople(viewer.userId, { q: params.q ?? "", tab, filters, limit: PAGE_SIZE });
  const api = new URLSearchParams({ type: "people", tab, limit: String(PAGE_SIZE) });
  if (params.q) api.set("q", params.q);
  if (filters.skillCategories?.length) api.set("skillCategories", filters.skillCategories.join(","));
  if (filters.industries?.length) api.set("industries", filters.industries.join(","));
  if (filters.commitment) api.set("commitment", filters.commitment);
  if (filters.availability) api.set("availability", filters.availability);
  if (filters.location) api.set("location", filters.location);
  if (filters.stage) api.set("stage", filters.stage);
  return <ResultsList kind="people" initialItems={page.items} initialCursor={page.nextCursor} apiQuery={api.toString()} clearHref={clearHref} />;
}
