import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading You&Me AI"
      className="-mx-4 flex h-[calc(100dvh-12.5rem)] min-h-[440px] overflow-hidden border-y border-border sm:mx-0 sm:rounded-[20px] sm:border lg:h-[calc(100dvh-5rem)]"
    >
      <div className="hidden w-64 shrink-0 space-y-2 border-r border-border p-4 lg:block">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="mt-4 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[14px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
