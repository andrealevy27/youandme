import { Skeleton } from "@/components/ui/skeleton";
import { ResultsSkeleton } from "@/components/discover/results-skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading Discover">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="mb-3 h-9 w-80 max-w-full" />
      <Skeleton className="mb-8 h-4 w-[28rem] max-w-full" />
      <Skeleton className="mb-4 h-14 w-full rounded-[14px]" />
      <Skeleton className="mb-6 h-10 w-full" />
      <ResultsSkeleton />
    </div>
  );
}
