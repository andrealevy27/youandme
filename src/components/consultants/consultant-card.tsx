import Link from "next/link";
import { Globe2, Languages, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatServicePrice } from "./format";
import { RatingSummary } from "./rating";

/** Serializable subset of ConsultantCard the card needs (keeps this usable from client and server). */
export type ConsultantCardData = {
  handle: string;
  name: string;
  avatarUrl: string | null;
  isDemo: boolean;
  headline: string;
  location: string | null;
  categories: { slug: string; name: string }[];
  fromPrice: { cents: number; currency: string; pricingType: "fixed" | "hourly" | "package" | "recurring"; billingInterval: string | null } | null;
  ratingAvg: number | null;
  reviewCount: number;
  languages: string[];
  remoteAvailable: boolean;
};

export function ConsultantCard({ c, why, reason, className }: { c: ConsultantCardData; why?: string[]; reason?: string; className?: string }) {
  return (
    <Link
      href={`/consultants/${c.handle}`}
      className={cn(
        "group flex h-full flex-col rounded-[16px] border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar name={c.name} src={c.avatarUrl} size="lg" rounded="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{c.name}</h3>
            {c.isDemo && <DemoBadge />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{c.headline}</p>
          <div className="mt-1.5">
            <RatingSummary avg={c.ratingAvg} count={c.reviewCount} />
          </div>
        </div>
      </div>

      {c.categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.categories.slice(0, 3).map((cat) => (
            <Badge key={cat.slug} variant="neutral">
              {cat.name}
            </Badge>
          ))}
        </div>
      )}

      {reason && (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] text-brand-ink">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{reason}</span>
        </p>
      )}
      {why && why.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Why this consultant">
          {why.map((w) => (
            <li key={w} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink">
              {w}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {c.languages.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Languages className="size-3.5" aria-hidden />
              <span className="truncate">{c.languages.slice(0, 2).join(", ")}{c.languages.length > 2 ? ` +${c.languages.length - 2}` : ""}</span>
            </span>
          )}
          {c.remoteAvailable && (
            <span className="inline-flex items-center gap-1">
              <Globe2 className="size-3.5" aria-hidden /> Remote
            </span>
          )}
        </div>
        {c.fromPrice && (
          <p className="shrink-0 text-right">
            <span className="block text-[11px] tracking-wide text-subtle uppercase">From</span>
            <span className="text-[15px] font-semibold tabular-nums">{formatServicePrice(c.fromPrice.cents, c.fromPrice.currency, c.fromPrice.pricingType, c.fromPrice.billingInterval)}</span>
          </p>
        )}
      </div>
    </Link>
  );
}

export function ConsultantCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading consultants">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[228px] animate-shimmer rounded-[16px] border border-border bg-card bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.5),transparent)] bg-[length:400px_100%] bg-no-repeat dark:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.04),transparent)]" />
      ))}
    </div>
  );
}
