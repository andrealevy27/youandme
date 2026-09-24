import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl" aria-busy="true" aria-label="Loading notifications">
      <Skeleton className="mb-8 h-8 w-48" />
      <div className="space-y-px overflow-hidden rounded-[16px] border border-border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 px-5 py-4">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
