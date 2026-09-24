import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarX2, History } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { BOOKING_TABS, listBookingsForUser, type BookingTab } from "@/server/bookings";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { BookingStatusBadge } from "@/components/bookings/status-badge";
import { formatDateTimeRange } from "@/components/consultants/format";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings" };

const TAB_LABELS: Record<BookingTab, string> = { upcoming: "Upcoming", past: "Past", cancelled: "Cancelled" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireViewerPage();
  const { tab: rawTab } = await searchParams;
  const tab: BookingTab = (BOOKING_TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as BookingTab) : "upcoming";
  const items = await listBookingsForUser(viewer.userId, tab);
  const now = new Date();

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Bookings"
        description="Sessions you've booked, sessions booked with you, and ones you've been added to."
        actions={
          <Button asChild variant="secondary">
            <Link href="/consultants">Find a consultant</Link>
          </Button>
        }
      />
      <nav aria-label="Booking tabs" className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {BOOKING_TABS.map((t) => (
          <Link
            key={t}
            href={t === "upcoming" ? "/bookings" : `/bookings?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "relative -mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              t === tab ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={tab === "upcoming" ? <CalendarDays /> : tab === "past" ? <History /> : <CalendarX2 />}
          title={tab === "upcoming" ? "Nothing booked yet" : tab === "past" ? "No past sessions" : "No cancelled bookings"}
          description={
            tab === "upcoming"
              ? "When you book a consultant — or someone books you — it shows up here with everything you need."
              : tab === "past"
                ? "Completed sessions appear here, where you can leave a review."
                : "Good news: nothing's been cancelled."
          }
          action={
            tab === "upcoming" ? (
              <Button asChild>
                <Link href="/consultants">Browse consultants</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((b) => {
            const when = formatDateTimeRange(b.startsAt, b.endsAt, viewer.timezone);
            const needsCompletion = b.status === "confirmed" && b.endsAt < now;
            return (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-4 shadow-soft transition-all hover:border-border-strong hover:shadow-float sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={b.counterpart.name} src={b.counterpart.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-[15px] font-semibold">
                        {b.serviceTitle} {b.counterpart.isDemo && <DemoBadge />}
                      </p>
                      <p className="truncate text-[13px] text-muted">
                        {b.role === "consultant" ? `Client: ${b.counterpart.name}` : `With ${b.counterpart.name}`}
                        {b.role === "teammate" ? " · You were added by your team" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium">{when.day}</p>
                      <p className="text-[13px] text-muted">
                        {when.time} {when.zone}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <BookingStatusBadge status={b.status} needsCompletion={needsCompletion} />
                      {b.role !== "teammate" && <span className="text-xs text-muted tabular-nums">{formatMoney(b.amountCents, b.currency)}</span>}
                      {b.status === "completed" && b.role === "client" && !b.hasReview && <span className="text-xs font-medium text-brand-ink">Leave a review</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
