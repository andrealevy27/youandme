import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton className="size-[120px] rounded-[18px]" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-80 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-12 w-32" />
          </div>
        </div>
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}
