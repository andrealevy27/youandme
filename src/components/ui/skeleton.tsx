import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-[10px] bg-surface bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.5),transparent)] bg-[length:400px_100%] bg-no-repeat dark:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.04),transparent)]",
        className,
      )}
    />
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-[16px] border border-border bg-card p-5" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}
