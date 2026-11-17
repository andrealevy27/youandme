import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Plain-language reasons first; the numeric score is small and secondary. */
export function WhyYouTwo({ reasons, score, className, max = 3 }: { reasons: string[]; score?: number | null; className?: string; max?: number }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium tracking-wide text-subtle uppercase">Why you two</p>
      <ul className="mt-2.5 space-y-2">
        {reasons.slice(0, max).map((r) => (
          <li key={r} className="flex gap-2.5 text-[15px] leading-snug">
            <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      {score != null && <ScoreNote score={score} className="mt-3" />}
    </div>
  );
}

export function ScoreNote({ score, className }: { score: number; className?: string }) {
  return (
    <p className={cn("text-[12px] text-subtle tabular-nums", className)} title="Overall fit from skills, goals, time, interests and working style">
      {score}% overall fit
    </p>
  );
}
