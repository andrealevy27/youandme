import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireViewerPage } from "@/server/auth/session";
import { env } from "@/server/env";
import { formatEventTime, listMyEvents } from "@/server/events";

export const metadata: Metadata = { title: "Events" };

export default async function MyEventsPage() {
  if (!env.STUDENT_MODE) notFound();
  const viewer = await requireViewerPage();
  const rows = await listMyEvents(viewer.userId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Events" description="Team hunts you've joined. Your introductions stay here after the event." />
      {rows.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-[16px] border border-border bg-card">
          {rows.map(({ event }) => (
            <li key={event.id}>
              <Link href={`/events/${event.code}`} className="group flex items-center gap-3 px-4 py-4">
                <CalendarDays className="size-5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{event.name}</span>
                  <span className="block text-[13px] text-muted">{formatEventTime(event)}</span>
                </span>
                <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title="No events yet"
          description="At a team hunt, scan the QR code on screen to join. Your five people to meet will show up here."
        />
      )}
    </div>
  );
}
