import Link from "next/link";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { analyzeTeamGaps, type TeamGapAnalysis } from "@/server/ai/gaps";
import { SEVERITY_LABELS } from "@/server/ai/labels";
import { cn } from "@/lib/utils";

const SEVERITY_VARIANT = { critical: "danger", important: "warning", nice: "neutral" } as const;

/**
 * Founding-team gaps for the home page and startup pages (server component).
 * Pass `analysis` if you already have it; otherwise it runs `analyzeTeamGaps(viewerId, startupId)`.
 * Only members may analyse a startup — for non-members, don't render this card.
 */
export async function TeamGapsCard({
  viewerId,
  startupId,
  analysis,
  maxGaps = 3,
  title = "Gaps in your founding team",
  className,
}: {
  viewerId: string;
  startupId?: string;
  analysis?: TeamGapAnalysis;
  maxGaps?: number;
  title?: string;
  className?: string;
}) {
  const a = analysis ?? (await analyzeTeamGaps(viewerId, startupId));

  if (a.status === "no_startup") {
    return (
      <Card className={cn("p-5 sm:p-6", className)}>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
            <Users className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted">{a.summary}</p>
            <Button asChild size="sm" variant="secondary" className="mt-3">
              <Link href="/startups/new">Add your startup</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const gaps = a.gaps.slice(0, maxGaps);
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">{a.summary}</p>
        </div>
        <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
      </div>

      {gaps.length > 0 && (
        <ul className="mt-5 space-y-5">
          {gaps.map((g) => (
            <li key={`${g.category}-${g.label}`} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{g.label}</h3>
                <Badge variant={SEVERITY_VARIANT[g.severity]}>{SEVERITY_LABELS[g.severity]}</Badge>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{g.reason}</p>
              {g.suggestedPeople.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-subtle">People who bring it</p>
                  <ul className="mt-1.5 flex flex-wrap gap-2">
                    {g.suggestedPeople.map((p) => (
                      <li key={p.userId}>
                        <Link
                          href={`/people/${p.handle}`}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-[13px] hover:border-border-strong"
                        >
                          <Avatar name={p.name} src={p.avatarUrl} size="xs" />
                          <span className="font-medium">{p.name}</span>
                          {p.isDemo && <span className="text-[11px] text-warning">Demo</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {g.consultantCategories.length > 0 && (
                <p className="mt-2.5 text-[13px] text-muted">
                  Or bring in a consultant:{" "}
                  {g.consultantCategories.map((c, i) => (
                    <span key={c.slug}>
                      {i > 0 && ", "}
                      <Link href={`/consultants?category=${encodeURIComponent(c.slug)}`} className="font-medium text-brand-ink hover:underline">
                        {c.name}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button asChild size="sm" variant="soft">
          <Link href={`/ai?q=${encodeURIComponent(`What are the biggest gaps in ${a.startup?.name ?? "my founding team"}?`)}`}>
            Ask You&amp;Me AI <ArrowRight />
          </Link>
        </Button>
        {a.gaps.length > maxGaps && <span className="self-center text-xs text-subtle">+{a.gaps.length - maxGaps} more gaps</span>}
      </div>
    </Card>
  );
}
