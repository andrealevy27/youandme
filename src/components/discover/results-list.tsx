"use client";
import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { PersonCard } from "@/components/people/person-card";
import type { PersonSearchResult, StartupSummary } from "@/server/search";
import { StartupCard } from "./startup-card";

type Props =
  | { kind: "people"; initialItems: PersonSearchResult[]; initialCursor: string | null; apiQuery: string; clearHref: string }
  | { kind: "startups"; initialItems: StartupSummary[]; initialCursor: string | null; apiQuery: string; clearHref: string };

/** Result grid with cursor-based "Load more". Remount (key) it when the query changes. */
export function ResultsList(props: Props) {
  const [items, setItems] = React.useState<(PersonSearchResult | StartupSummary)[]>(props.initialItems);
  const [cursor, setCursor] = React.useState(props.initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/v1/search?${props.apiQuery}&cursor=${encodeURIComponent(cursor)}`, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: (PersonSearchResult | StartupSummary)[]; nextCursor: string | null };
      setItems((prev) => {
        const seen = new Set(prev.map(keyOf));
        return [...prev, ...data.items.filter((i) => !seen.has(keyOf(i)))];
      });
      setCursor(data.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={<Search />}
        title="No one matches that yet. Try fewer filters."
        description="Broaden your words, remove a filter or two, or ask You&Me AI to search for you."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={props.clearHref}>Clear filters</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
        {items.map((item) => (
          <li key={keyOf(item)} className="min-w-0 animate-fade-up">
            {"person" in item ? (
              <PersonCard person={item.person} reason={item.matched.length ? `Matches ${item.matched.join(", ")}` : undefined} />
            ) : (
              <StartupCard startup={item} />
            )}
          </li>
        ))}
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <li key={`sk-${i}`}>
              <CardSkeleton />
            </li>
          ))}
      </ul>
      {error && (
        <div className="mt-4">
          <ErrorState message="We couldn't load more results. Try again." />
        </div>
      )}
      {cursor && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={loadMore} loading={loading}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function keyOf(item: PersonSearchResult | StartupSummary) {
  return "person" in item ? `p:${item.person.userId}` : `s:${item.id}`;
}
