import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading">
      <div>
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <Skeleton className="mt-6 h-14 w-full max-w-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
        <CardSkeleton lines={1} />
      </div>
    </div>
  );
}
