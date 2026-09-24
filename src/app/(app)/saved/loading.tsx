import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading saved items">
      <Skeleton className="mb-8 h-8 w-32" />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <div className="flex gap-2 lg:flex-col">
          <Skeleton className="h-10 w-28 lg:w-full" />
          <Skeleton className="h-10 w-28 lg:w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} lines={1} />
          ))}
        </div>
      </div>
    </div>
  );
}
