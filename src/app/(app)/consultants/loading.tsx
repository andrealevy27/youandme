import { Skeleton } from "@/components/ui/skeleton";
import { ConsultantCardSkeletonGrid } from "@/components/consultants/consultant-card";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading consultants">
      <Skeleton className="mb-3 h-4 w-40" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <Skeleton className="mt-6 h-40 w-full max-w-3xl rounded-[20px]" />
      <div className="mt-8 mb-8 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <ConsultantCardSkeletonGrid />
    </div>
  );
}
