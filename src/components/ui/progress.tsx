import { cn } from "@/lib/utils";

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface", className)}
    >
      <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Circular score with its number always visible — never a percentage without context. */
export function ScoreRing({ score, size = 56, className }: { score: number; size?: number; className?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={4} className="fill-none stroke-surface" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="fill-none stroke-brand transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums" aria-label={`${score} percent compatibility`}>
        {score}
      </span>
    </div>
  );
}
