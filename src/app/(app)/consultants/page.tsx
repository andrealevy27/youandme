import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, Briefcase, SearchX, Sparkles } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { features } from "@/server/env";
import {
  getRecommendedConsultantsForUser,
  listActiveCategories,
  listConsultantLanguages,
  listIndustries,
  searchConsultants,
  type ConsultantSearchInput,
} from "@/server/consultants";
import { toFailure } from "@/server/errors";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import { ConsultantCard, ConsultantCardSkeletonGrid } from "@/components/consultants/consultant-card";
import { FiltersSheet, FiltersSidebar, SortSelect, activeFilterCount, type FilterOptions } from "@/components/consultants/filters";
import { NeedSearch } from "@/components/consultants/need-search";
import { formatMoney } from "@/lib/utils";
import { STAGE_LABELS, type StartupStage } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Consultants" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

function hrefWith(sp: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
  const s = next.toString();
  return s ? `/consultants?${s}` : "/consultants";
}

export default async function ConsultantsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const viewer = await requireViewerPage();
  const raw = await searchParams;
  const sp = Object.fromEntries(
    ["need", "q", "category", "industry", "maxPrice", "minRating", "stage", "language", "remote", "week", "sort", "page"].map((k) => [k, one(raw[k])]),
  ) as Record<string, string | undefined>;

  const [categories, industries, languages] = await Promise.all([listActiveCategories(), listIndustries(), listConsultantLanguages()]);
  const options: FilterOptions = { categories: categories.map(({ slug, name }) => ({ slug, name })), industries, languages };
  const filterCount = activeFilterCount(sp);
  const browsing = !sp.need && filterCount === 0;

  return (
    <div className="animate-fade-up">
      <section className="relative -mx-4 mb-8 overflow-hidden px-4 pt-2 pb-2 sm:mx-0 sm:px-0">
        <p className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink">
          <Briefcase className="size-3.5" aria-hidden /> Consultant marketplace
        </p>
        <h1 className="max-w-2xl text-[32px] leading-[1.08] font-semibold tracking-tight sm:text-[44px]">
          Find expertise <span className="text-gradient">when you need it.</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-muted sm:text-base">
          Vetted operators for growth, fundraising, product, legal and more. Describe the problem — we&apos;ll show you who can actually help.
        </p>
        <div className="mt-6 max-w-3xl">
          <NeedSearch initial={sp.need} aiEnabled={features.ai} />
        </div>
      </section>

      <nav aria-label="Categories" className="scrollbar-none -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link
          href={hrefWith({ ...sp, need: undefined, page: undefined }, { category: undefined })}
          aria-current={!sp.category ? "page" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13px] font-medium transition-colors",
            !sp.category ? "border-foreground bg-ink text-ink-foreground" : "border-border-strong bg-card hover:border-foreground/40",
          )}
        >
          All
        </Link>
        {categories.map((c) => {
          const active = sp.category === c.slug;
          return (
            <Link
              key={c.slug}
              href={hrefWith({ ...sp, need: undefined, page: undefined }, { category: active ? undefined : c.slug })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13px] font-medium transition-colors",
                active ? "border-foreground bg-ink text-ink-foreground" : "border-border-strong bg-card hover:border-foreground/40",
              )}
            >
              {c.name}
            </Link>
          );
        })}
      </nav>

      {browsing && (
        <Suspense fallback={<ConsultantCardSkeletonGrid count={3} />}>
          <Recommended userId={viewer.userId} />
        </Suspense>
      )}

      <div id="results" className="grid scroll-mt-6 gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <FiltersSidebar options={options} />
        <div className="min-w-0">
          <Suspense key={JSON.stringify(sp)} fallback={<ConsultantCardSkeletonGrid />}>
            <Results viewerId={viewer.userId} sp={sp} options={options} filterCount={filterCount} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Recommended({ userId }: { userId: string }) {
  const recs = await getRecommendedConsultantsForUser(userId, 3);
  if (!recs.length) return null;
  return (
    <section className="mb-10">
      <SectionHeader title="Recommended for you" description="Based on your open needs, your startup's stage and industries." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {recs.map((r) => (
          <ConsultantCard key={r.consultant.userId} c={r.consultant} reason={r.reason} />
        ))}
      </div>
    </section>
  );
}

async function Results({ viewerId, sp, options, filterCount }: { viewerId: string; sp: Record<string, string | undefined>; options: FilterOptions; filterCount: number }) {
  const maxPriceDollars = sp.maxPrice ? Number(sp.maxPrice) : undefined;
  const input: ConsultantSearchInput = {
    need: sp.need,
    q: sp.q,
    category: sp.category,
    industry: sp.industry,
    maxPrice: maxPriceDollars && Number.isFinite(maxPriceDollars) && maxPriceDollars > 0 ? Math.round(maxPriceDollars * 100) : undefined,
    minRating: sp.minRating ? Number(sp.minRating) : undefined,
    stage: sp.stage as ConsultantSearchInput["stage"],
    language: sp.language,
    remote: sp.remote === "1",
    availableThisWeek: sp.week === "1",
    sort: sp.sort as ConsultantSearchInput["sort"],
    page: sp.page ? Number(sp.page) : 1,
    limit: 12,
  };

  let data;
  try {
    data = await searchConsultants(viewerId, input);
  } catch (err) {
    const failure = toFailure(err);
    return <ErrorState message={failure.error} />;
  }
  const { results, interpreted, page, hasMore } = data;
  const title = sp.need ? "Matches for what you described" : sp.category ? (options.categories.find((c) => c.slug === sp.category)?.name ?? "Consultants") : "All consultants";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">
          <FiltersSheet options={options} count={filterCount} />
          <SortSelect value={sp.sort ?? "relevance"} />
        </div>
      </div>

      {interpreted && (
        <div className="mb-5 rounded-[14px] border border-border bg-surface/60 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium">
            <Sparkles className="size-3.5 text-brand" aria-hidden />
            {interpreted.source === "ai" ? "Here's what we understood" : "Here's what we picked up (basic mode)"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {interpreted.categoryNames.map((n) => (
              <span key={n} className="rounded-full bg-card px-2.5 py-1 font-medium ring-1 ring-border">
                {n}
              </span>
            ))}
            {interpreted.maxBudgetCents && <span className="rounded-full bg-card px-2.5 py-1 ring-1 ring-border">Budget up to {formatMoney(interpreted.maxBudgetCents)}</span>}
            {interpreted.stage && <span className="rounded-full bg-card px-2.5 py-1 ring-1 ring-border">{STAGE_LABELS[interpreted.stage as StartupStage]} stage</span>}
            {!interpreted.categoryNames.length && interpreted.keywords.length > 0 && (
              <span className="rounded-full bg-card px-2.5 py-1 ring-1 ring-border">Keywords: {interpreted.keywords.slice(0, 5).join(", ")}</span>
            )}
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title={sp.need ? "No one matches that yet" : "No consultants match these filters"}
          description={
            sp.need
              ? "We only show consultants whose real expertise fits your request. Try describing it differently, or browse a category."
              : "Try removing a filter or two — or describe what you need and we'll look across every category."
          }
          action={
            <Button asChild variant="secondary">
              <Link href="/consultants">Clear search</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((c) => (
              <ConsultantCard key={c.userId} c={c} why={c.why} />
            ))}
          </div>
          {(page > 1 || hasMore) && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
              {page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`${hrefWith(sp, { page: page - 1 > 1 ? String(page - 1) : undefined })}#results`}>
                    <ArrowLeft /> Previous
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-[13px] text-muted">Page {page}</span>
              {hasMore ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`${hrefWith(sp, { page: String(page + 1) })}#results`}>
                    Next <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
