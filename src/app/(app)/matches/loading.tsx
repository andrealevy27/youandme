import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading matches">
      <Skeleton className="mb-3 h-4 w-32" />
      <Skeleton className="mb-3 h-9 w-80 max-w-full" />
      <Skeleton className="mb-10 h-4 w-[28rem] max-w-full" />
      <div className="space-y-5">
        {[0, 1].map((i) => (
          <div key={i} className="grid overflow-hidden rounded-[20px] border border-border bg-card md:grid-cols-[280px_1fr]">
            <div className="flex flex-col items-center gap-3 border-b border-border p-7 md:border-r md:border-b-0">
              <Skeleton className="size-[120px] rounded-[18px]" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <div className="space-y-3 p-7">
              <div className="flex gap-4">
                <Skeleton className="size-[60px] rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
