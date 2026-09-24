"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { STAGE_LABELS, STARTUP_STAGES } from "@/lib/domain";

type Option = { slug: string; name: string };
export type FilterOptions = { categories: Option[]; industries: Option[]; languages: string[] };

const FILTER_KEYS = ["q", "category", "industry", "maxPrice", "minRating", "stage", "language", "remote", "week"] as const;

export function activeFilterCount(params: URLSearchParams | Record<string, string | undefined>) {
  const get = (k: string) => (params instanceof URLSearchParams ? params.get(k) : params[k]);
  return FILTER_KEYS.filter((k) => !!get(k)).length;
}

/** Filters are plain URL state: server-rendered results, shareable links, back button works. */
function FilterForm({ options, idPrefix, onDone }: { options: FilterOptions; idPrefix: string; onDone?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const next = new URLSearchParams(params.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    next.delete("page");
    for (const [k, v] of data.entries()) if (typeof v === "string" && v.trim()) next.set(k, v.trim());
    start(() => router.push(`/consultants?${next.toString()}#results`));
    onDone?.();
  }

  function reset() {
    const next = new URLSearchParams(params.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    next.delete("page");
    start(() => router.push(`/consultants?${next.toString()}#results`));
    onDone?.();
  }

  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <form
      key={params.toString()}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Keyword" htmlFor={id("q")}>
        <Input id={id("q")} name="q" defaultValue={params.get("q") ?? ""} placeholder="e.g. pitch deck, SEO" maxLength={200} />
      </Field>
      <Field label="Category" htmlFor={id("category")}>
        <NativeSelect id={id("category")} name="category" defaultValue={params.get("category") ?? ""}>
          <option value="">Any category</option>
          {options.categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Industry" htmlFor={id("industry")}>
        <NativeSelect id={id("industry")} name="industry" defaultValue={params.get("industry") ?? ""}>
          <option value="">Any industry</option>
          {options.industries.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Stage they work with" htmlFor={id("stage")}>
        <NativeSelect id={id("stage")} name="stage" defaultValue={params.get("stage") ?? ""}>
          <option value="">Any stage</option>
          {STARTUP_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Max price (USD)" htmlFor={id("maxPrice")} hint="A service at or under this price">
        <Input id={id("maxPrice")} name="maxPrice" type="number" inputMode="numeric" min={1} step={1} defaultValue={params.get("maxPrice") ?? ""} placeholder="e.g. 500" />
      </Field>
      <Field label="Minimum rating" htmlFor={id("minRating")}>
        <NativeSelect id={id("minRating")} name="minRating" defaultValue={params.get("minRating") ?? ""}>
          <option value="">Any (including new)</option>
          <option value="4.5">4.5 and up</option>
          <option value="4">4.0 and up</option>
          <option value="3">3.0 and up</option>
        </NativeSelect>
      </Field>
      {options.languages.length > 0 && (
        <Field label="Language" htmlFor={id("language")}>
          <NativeSelect id={id("language")} name="language" defaultValue={params.get("language") ?? ""}>
            <option value="">Any language</option>
            {options.languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <SwitchRow name="remote" id={id("remote")} label="Works remotely" defaultChecked={params.get("remote") === "1"} />
      <SwitchRow name="week" id={id("week")} label="Has open slots this week" defaultChecked={params.get("week") === "1"} />
      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1" loading={pending}>
          Apply filters
        </Button>
        <Button type="button" variant="ghost" onClick={reset}>
          Reset
        </Button>
      </div>
    </form>
  );
}

function SwitchRow({ name, id, label, defaultChecked }: { name: string; id: string; label: string; defaultChecked: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <Switch id={id} name={name} value="1" defaultChecked={defaultChecked} />
    </div>
  );
}

export function FiltersSidebar({ options }: { options: FilterOptions }) {
  return (
    <aside aria-label="Filters" className="hidden lg:block">
      <div className="sticky top-8 rounded-[16px] border border-border bg-card p-5">
        <h2 className="mb-4 text-[15px] font-semibold">Filters</h2>
        <FilterForm options={options} idPrefix="side" />
      </div>
    </aside>
  );
}

export function FiltersSheet({ options, count }: { options: FilterOptions; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="lg:hidden">
          <SlidersHorizontal /> Filters{count ? ` (${count})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent title="Filters" description="Narrow down consultants.">
        <FilterForm options={options} idPrefix="sheet" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-[13px] text-muted">
        Sort
      </label>
      <NativeSelect
        id="sort"
        value={value}
        className="h-9 w-auto text-sm"
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("sort", e.target.value);
          next.delete("page");
          router.push(`/consultants?${next.toString()}#results`);
        }}
      >
        <option value="relevance">Best match</option>
        <option value="rating">Highest rated</option>
        <option value="price_low">Price: low to high</option>
        <option value="price_high">Price: high to low</option>
      </NativeSelect>
    </div>
  );
}
