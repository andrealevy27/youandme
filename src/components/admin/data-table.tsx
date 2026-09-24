import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Hide on small screens to keep the table readable at 360px. */
  hideOnMobile?: boolean;
  align?: "left" | "right";
};

/** Lightweight, server-rendered table. Horizontal scroll on narrow screens, never a page overflow. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className={cn("overflow-hidden rounded-[16px] border border-border bg-card shadow-soft", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-border bg-surface/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-[12px] font-medium whitespace-nowrap text-muted",
                    c.align === "right" && "text-right",
                    c.hideOnMobile && "hidden md:table-cell",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-surface/40">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn("px-4 py-3 align-top", c.align === "right" && "text-right", c.hideOnMobile && "hidden md:table-cell", c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Params = Record<string, string | string[] | undefined>;

/** Build an href that keeps the current filters and overrides some keys (null removes a key). */
export function hrefWith(basePath: string, params: Params, overrides: Record<string, string | number | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) sp.set(k, val);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  basePath,
  params,
  page,
  total,
  pageSize = 25,
  pageParam = "page",
}: {
  basePath: string;
  params: Params;
  page: number;
  total: number;
  pageSize?: number;
  pageParam?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = "inline-flex h-8 items-center gap-1 rounded-[10px] border border-border-strong bg-card px-2.5 text-[13px] font-medium hover:bg-surface";
  const disabledCls = "pointer-events-none opacity-40";
  return (
    <nav className="mt-3 flex items-center justify-between gap-3 text-[13px] text-muted" aria-label="Pagination">
      <p className="tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={hrefWith(basePath, params, { [pageParam]: page > 2 ? page - 1 : null })}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(linkCls, page <= 1 && disabledCls)}
        >
          <ChevronLeft className="size-4" aria-hidden /> Prev
        </Link>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Link
          href={hrefWith(basePath, params, { [pageParam]: page + 1 })}
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={cn(linkCls, page >= pages && disabledCls)}
        >
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}

/** Link-based filter tabs (status queues). Resets pagination when switching. */
export function FilterTabs({
  basePath,
  params,
  paramKey,
  current,
  options,
}: {
  basePath: string;
  params: Params;
  paramKey: string;
  current: string;
  options: { value: string; label: string; count?: number }[];
}) {
  return (
    <div className="scrollbar-none mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
      {options.map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value}
            role="tab"
            aria-selected={active}
            href={hrefWith(basePath, params, { [paramKey]: o.value, page: null })}
            className={cn(
              "relative -mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="rounded-full bg-surface px-1.5 text-[11.5px] text-muted tabular-nums">{o.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}

/** Plain GET search form — works without JavaScript. */
export function SearchForm({
  basePath,
  params,
  name = "q",
  placeholder,
  keep = [],
}: {
  basePath: string;
  params: Params;
  name?: string;
  placeholder: string;
  keep?: string[];
}) {
  const value = params[name];
  return (
    <form action={basePath} method="get" role="search" className="mb-4 flex gap-2">
      {keep.map((k) => {
        const v = params[k];
        const val = Array.isArray(v) ? v[0] : v;
        return val ? <input key={k} type="hidden" name={k} value={val} /> : null;
      })}
      <label htmlFor={`search-${name}`} className="sr-only">
        {placeholder}
      </label>
      <input
        id={`search-${name}`}
        name={name}
        type="search"
        defaultValue={Array.isArray(value) ? value[0] : value}
        placeholder={placeholder}
        className="h-10 w-full max-w-md rounded-[10px] border border-border-strong bg-card px-3.5 text-sm placeholder:text-subtle focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none"
      />
      <button type="submit" className="h-10 shrink-0 rounded-[10px] bg-ink px-4 text-sm font-medium text-ink-foreground hover:opacity-90">
        Search
      </button>
    </form>
  );
}

/** Collapsed JSON viewer for snapshots and audit metadata. */
export function JsonDetails({ value, summary = "Details" }: { value: unknown; summary?: string }) {
  if (value === null || value === undefined || (typeof value === "object" && Object.keys(value as object).length === 0)) {
    return <span className="text-subtle">—</span>;
  }
  return (
    <details className="group max-w-[420px]">
      <summary className="cursor-pointer text-[12.5px] font-medium text-brand-ink select-none">{summary}</summary>
      <pre className="mt-2 max-h-72 overflow-auto rounded-[10px] bg-surface p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[12.5px] text-subtle">{children}</span>;
}

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime && { hour: "numeric", minute: "2-digit" }),
    timeZone: "UTC",
  }) + (withTime ? " UTC" : "");
}
