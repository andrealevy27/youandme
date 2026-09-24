import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRating } from "./format";

/** Rating with count — or an honest "New" label. Never a fabricated score. */
export function RatingSummary({ avg, count, className, size = "sm" }: { avg: number | null; count: number; className?: string; size?: "sm" | "md" }) {
  if (!count || avg == null) {
    return <span className={cn("text-muted", size === "sm" ? "text-[13px]" : "text-sm", className)}>New — no reviews yet</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1", size === "sm" ? "text-[13px]" : "text-sm", className)}>
      <Star className={cn("fill-current text-warning", size === "sm" ? "size-3.5" : "size-4")} aria-hidden />
      <span className="font-semibold tabular-nums">{formatRating(avg)}</span>
      <span className="text-muted">
        ({count} review{count === 1 ? "" : "s"})
      </span>
      <span className="sr-only">
        Rated {formatRating(avg)} out of 5 from {count} reviews
      </span>
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= Math.round(value) ? "fill-current text-warning" : "text-border-strong")} aria-hidden />
      ))}
    </span>
  );
}
