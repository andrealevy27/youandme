import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading booking">
      <Skeleton className="mb-5 h-4 w-20" />
      <Skeleton className="h-6 w-28 rounded-full" />
      <Skeleton className="mt-3 h-8 w-72 max-w-full" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
