import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-5" aria-busy="true" aria-label="Loading conversation">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-10 w-2/3 rounded-[18px]" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-[18px]" />
        <Skeleton className="h-16 w-3/5 rounded-[18px]" />
        <Skeleton className="ml-auto h-10 w-2/5 rounded-[18px]" />
      </div>
    </div>
  );
}
