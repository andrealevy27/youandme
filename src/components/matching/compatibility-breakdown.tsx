import { AlertTriangle, Check } from "lucide-react";
import { ScoreRing } from "@/components/ui/progress";
import type { CompatibilityResult } from "@/server/matching/types";
import { cn } from "@/lib/utils";

/** Explained compatibility: never a bare percentage. */
export function CompatibilityBreakdown({ result }: { result: CompatibilityResult }) {
  const known = result.factors.filter((f) => f.known && f.weight > 0).sort((a, b) => b.weight - a.weight);
  const unknown = result.factors.filter((f) => !f.known);
  return (
    <div>
      <div className="flex items-start gap-4">
        <ScoreRing score={result.score} size={64} />
        <p className="text-[15px] leading-relaxed">{result.explanation}</p>
      </div>
      <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {known.map((f) => (
          <li key={f.key}>
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <span className="font-medium">{f.label}</span>
              <span className="text-subtle tabular-nums">{Math.round(f.score * 100)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface">
              <div
                className={cn("h-full rounded-full", f.score >= 0.75 ? "bg-brand" : f.score >= 0.5 ? "bg-brand/50" : "bg-warning/60")}
                style={{ width: `${Math.round(f.score * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[13px] text-muted">{f.detail}</p>
          </li>
        ))}
      </ul>
      {result.frictions.length > 0 && (
        <div className="mt-6 rounded-[12px] border border-warning/25 bg-warning-soft/60 p-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-warning uppercase">Potential friction</p>
          <ul className="space-y-2">
            {result.frictions.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="font-medium">{f.title}.</span> <span className="text-muted">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.strengths.length > 0 && result.frictions.length === 0 && (
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-success">
          <Check className="size-4" aria-hidden /> No obvious friction points from your profiles.
        </p>
      )}
      {unknown.length > 0 && (
        <p className="mt-4 text-xs text-subtle">Not enough data yet for: {unknown.map((f) => f.label.toLowerCase()).join(", ")}.</p>
      )}
    </div>
  );
}
