import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading workspace">
      <Skeleton className="mb-2 h-4 w-40" />
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-[14px]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}
