import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** One avatar for 1:1 threads; two overlapping avatars for groups. Always a 44px box so rows align. */
export function AvatarStack({ people, className }: { people: { name: string; avatarUrl: string | null }[]; className?: string }) {
  const [a, b] = people;
  return (
    <span className={cn("relative inline-flex size-11 shrink-0 items-center justify-center", className)}>
      {!a ? (
        <span className="size-10 rounded-full bg-surface" aria-hidden />
      ) : !b ? (
        <Avatar name={a.name} src={a.avatarUrl} size="md" />
      ) : (
        <>
          <Avatar name={a.name} src={a.avatarUrl} size="sm" rounded="xl" className="absolute top-0 left-0 !rounded-[10px]" />
          <Avatar name={b.name} src={b.avatarUrl} size="sm" className="absolute right-0 bottom-0 ring-2 ring-card" />
        </>
      )}
    </span>
  );
}
