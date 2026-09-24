import Link from "next/link";
import { cn } from "@/lib/utils";

export function MatchesTabs({ active }: { active: "today" | "connections" }) {
  const tabs = [
    { key: "today", href: "/matches", label: "Today" },
    { key: "connections", href: "/matches/connections", label: "Your matches" },
  ] as const;
  return (
    <nav className="mb-6 flex gap-1 border-b border-border" aria-label="Matches">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            active === t.key ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
