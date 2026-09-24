import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading bookings">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 mb-6 flex gap-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-[16px]" />
        ))}
      </div>
    </div>
  );
}
