import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading booking">
      <Skeleton className="mb-5 h-4 w-24" />
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}
