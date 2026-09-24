import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-[16px] border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-[16px] border border-border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
