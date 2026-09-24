"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import {
  AVAILABILITY,
  AVAILABILITY_LABELS,
  COMMITMENTS,
  COMMITMENT_LABELS,
  NEED_TYPES,
  NEED_TYPE_LABELS,
  SKILL_CATEGORY_LABELS,
  STAGE_LABELS,
  STARTUP_STAGES,
  type SkillCategory,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { DISCOVER_EXAMPLE, DISCOVER_TABS, type DiscoverTab } from "./config";

const CATEGORY_CHIPS: SkillCategory[] = ["engineering", "ai_ml", "design", "product", "growth", "sales", "finance", "operations"];

type Params = Record<string, string | undefined>;

function buildHref(pathname: string, params: Params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${pathname}?${s}` : pathname;
}

function toggleCsv(csv: string | undefined, value: string) {
  const set = new Set((csv ?? "").split(",").filter(Boolean));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set].join(",") || undefined;
}

/** Search box, tabs and filter chips. All state lives in the URL so results are shareable. */
export function DiscoverControls({
  tab,
  params,
  industries,
}: {
  tab: DiscoverTab;
  params: Params;
  industries: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [q, setQ] = React.useState(params.q ?? "");
  const filterKeys = tab === "startups" ? ["stage", "industry", "lookingFor"] : ["cat", "industry", "commitment", "availability", "location", "stage"];
  const activeCount = filterKeys.filter((k) => params[k]).length;
  const [open, setOpen] = React.useState(activeCount > 0);

  // Keep the input in sync when the URL query changes (back/forward, tab links).
  const [prevQ, setPrevQ] = React.useState(params.q);
  if (params.q !== prevQ) {
    setPrevQ(params.q);
    setQ(params.q ?? "");
  }

  const go = (next: Params) => startTransition(() => router.push(buildHref(pathname, next), { scroll: false }));
  const set = (key: string, value: string | undefined) => go({ ...params, tab, [key]: value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    go({ ...params, tab, q: q.trim() || undefined });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor="discover-q" className="sr-only">
          Search the network
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" aria-hidden />
        <Input
          id="discover-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Try: ${DISCOVER_EXAMPLE}`}
          className="h-14 rounded-[14px] pr-28 pl-12 text-base shadow-soft"
          maxLength={200}
          autoComplete="off"
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                go({ ...params, tab, q: undefined });
              }}
              className="rounded-full p-2 text-subtle hover:bg-surface hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
          <Button type="submit" size="sm" loading={pending}>
            Search
          </Button>
        </div>
      </form>

      <nav aria-label="Discover sections" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
        {DISCOVER_TABS.map((t) => {
          const active = t.key === tab;
          // Switching tabs keeps the query but drops filters that don't apply.
          const href = buildHref(pathname, { q: params.q, tab: t.key === "people" ? undefined : t.key });
          return (
            <Link
              key={t.key}
              href={href}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative -mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab !== "consultants" && (
        <div className={cn("space-y-3 transition-opacity", pending && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2">
            {tab !== "startups" &&
              CATEGORY_CHIPS.map((c) => (
                <Chip key={c} size="sm" selected={(params.cat ?? "").split(",").includes(c)} onToggle={() => set("cat", toggleCsv(params.cat, c))}>
                  {SKILL_CATEGORY_LABELS[c]}
                </Chip>
              ))}
            {tab === "startups" &&
              NEED_TYPES.filter((n) => n !== "other").map((n) => (
                <Chip key={n} size="sm" selected={params.lookingFor === n} onToggle={() => set("lookingFor", params.lookingFor === n ? undefined : n)}>
                  Needs {NEED_TYPE_LABELS[n].toLowerCase()}
                </Chip>
              ))}
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="discover-filters">
              <SlidersHorizontal />
              More filters{activeCount ? ` · ${activeCount}` : ""}
            </Button>
            {activeCount > 0 && (
              <Button variant="link" size="sm" onClick={() => go({ q: params.q, tab: tab === "people" ? undefined : tab })}>
                Clear
              </Button>
            )}
          </div>

          {open && (
            <div id="discover-filters" className="space-y-3 rounded-[14px] border border-border bg-surface/50 p-4">
              {tab === "startups" ? (
                <FilterRow label="Stage">
                  {STARTUP_STAGES.map((s) => (
                    <Chip key={s} size="sm" selected={params.stage === s} onToggle={() => set("stage", params.stage === s ? undefined : s)}>
                      {STAGE_LABELS[s]}
                    </Chip>
                  ))}
                </FilterRow>
              ) : (
                <>
                  <FilterRow label="Commitment">
                    {COMMITMENTS.map((c) => (
                      <Chip key={c} size="sm" selected={params.commitment === c} onToggle={() => set("commitment", params.commitment === c ? undefined : c)}>
                        {COMMITMENT_LABELS[c]}
                      </Chip>
                    ))}
                  </FilterRow>
                  <FilterRow label="Availability">
                    {AVAILABILITY.map((a) => (
                      <Chip key={a} size="sm" selected={params.availability === a} onToggle={() => set("availability", params.availability === a ? undefined : a)}>
                        {AVAILABILITY_LABELS[a]}
                      </Chip>
                    ))}
                  </FilterRow>
                  <FilterRow label="Stage they want to join">
                    {STARTUP_STAGES.map((s) => (
                      <Chip key={s} size="sm" selected={params.stage === s} onToggle={() => set("stage", params.stage === s ? undefined : s)}>
                        {STAGE_LABELS[s]}
                      </Chip>
                    ))}
                  </FilterRow>
                </>
              )}
              <FilterRow label="Industry">
                {industries.map((i) => {
                  const selected = tab === "startups" ? params.industry === i.slug : (params.industry ?? "").split(",").includes(i.slug);
                  return (
                    <Chip
                      key={i.slug}
                      size="sm"
                      selected={selected}
                      onToggle={() =>
                        set("industry", tab === "startups" ? (selected ? undefined : i.slug) : toggleCsv(params.industry, i.slug))
                      }
                    >
                      {i.name}
                    </Chip>
                  );
                })}
              </FilterRow>
              {tab !== "startups" && <LocationFilter value={params.location ?? ""} onApply={(v) => set("location", v || undefined)} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-subtle">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function LocationFilter({ value, onApply }: { value: string; onApply: (v: string) => void }) {
  const [v, setV] = React.useState(value);
  return (
    <form
      className="flex max-w-sm items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(v.trim());
      }}
    >
      <div className="flex-1">
        <label htmlFor="discover-location" className="mb-2 block text-xs font-medium text-subtle">
          Location
        </label>
        <Input id="discover-location" value={v} onChange={(e) => setV(e.target.value)} placeholder="City or country" className="h-9 text-sm" maxLength={80} />
      </div>
      <Button type="submit" variant="secondary" size="sm" className="h-9">
        Apply
      </Button>
    </form>
  );
}
