import { DIMENSIONS, DIMENSION_KEYS, describeDimension, type DimensionKey } from "@/lib/personality";
import { cn } from "@/lib/utils";

/** Bipolar bars for each working-style dimension. Optionally overlays a second person for comparison. */
export function WorkingStyleBars({
  scores,
  compare,
  compareLabel,
  className,
}: {
  scores: Partial<Record<DimensionKey, number>>;
  compare?: Partial<Record<DimensionKey, number>> | null;
  compareLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)}>
      {compare && (
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-ink" /> {compareLabel ?? "Them"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-brand bg-card" /> You
          </span>
        </div>
      )}
      {DIMENSION_KEYS.map((key) => {
        const v = scores[key];
        if (v === undefined) return null;
        const d = DIMENSIONS[key];
        const pos = (v + 100) / 2;
        const cmp = compare?.[key];
        return (
          <div key={key}>
            <div className="mb-2 flex justify-between text-[13px]">
              <span className={cn(v < -19 ? "font-medium text-foreground" : "text-muted")}>{d.left}</span>
              <span className={cn(v > 19 ? "font-medium text-foreground" : "text-muted")}>{d.right}</span>
            </div>
            <div className="relative h-2 rounded-full bg-surface" role="img" aria-label={`${describeDimension(key, v)}${cmp !== undefined ? `; ${compareLabel ?? "you"}: ${describeDimension(key, cmp).toLowerCase()}` : ""}`}>
              <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-border-strong" />
              {cmp !== undefined && (
                <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-card" style={{ left: `${(cmp + 100) / 2}%` }} />
              )}
              <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-card" style={{ left: `${pos}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
