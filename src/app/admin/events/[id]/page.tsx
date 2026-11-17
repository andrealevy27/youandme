import Link from "next/link";
import { notFound } from "next/navigation";
import { MonitorPlay } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/admin/stat-card";
import { AdminActionButton } from "@/components/admin/admin-action";
import { StatusBadge } from "@/components/admin/status-badge";
import { CopyButton } from "@/components/student/copy-button";
import { requireAdminPage } from "@/server/auth/session";
import { formatEventTime, getEventById, getEventStats } from "@/server/events";
import { eventJoinUrl, eventQrSvg } from "@/server/events/links";
import { schoolBySlug } from "@/lib/schools";
import { setEventStatusAction } from "../actions";

export const metadata = { title: "Event" };

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("events.manage");
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  const [stats, qr] = await Promise.all([getEventStats(event.id), eventQrSvg(event.code)]);
  const url = eventJoinUrl(event.code);
  return (
    <>
      <PageHeader
        title={event.name}
        description={`${formatEventTime(event)} · ${schoolBySlug(event.school)?.name ?? "Students from any school"}${event.location ? ` · ${event.location}` : ""}`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={event.status} />
        <Button asChild size="sm">
          <Link href={`/admin/events/${event.id}/present`}>
            <MonitorPlay /> Present QR code
          </Link>
        </Button>
        <AdminActionButton
          action={setEventStatusAction}
          payload={{ id: event.id, status: event.status === "active" ? "closed" : "active" }}
          label={event.status === "active" ? "Close event" : "Reopen event"}
          success={event.status === "active" ? "Event closed. Introductions stay in attendees' accounts." : "Event reopened."}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Attendees" value={stats.attendees} />
            <StatCard label="Introductions" value={stats.introductions} />
            <StatCard label="Matches" value={stats.matches} hint="Both said yes" tone="brand" />
            <StatCard label="Cofounder trials" value={stats.trialsStarted} hint={`${stats.trialsContinuing} continuing`} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Join link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="rounded-[10px] bg-surface px-3 py-2 font-mono text-[13px] break-all">{url}</p>
              <div className="flex flex-wrap items-center gap-3">
                <CopyButton value={url} label="Copy link" />
                <span className="text-sm text-muted">
                  Code: <span className="font-mono font-semibold tracking-widest text-foreground">{event.code}</span>
                </span>
              </div>
              <p className="text-[13px] text-muted">
                Attendees sign up with their school email, answer a few questions on their phone, and get five people to meet with one reason each.
                Organizers see the numbers above — not attendees&apos; profiles or introductions.
              </p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            <div className="w-full max-w-[260px] overflow-hidden rounded-[12px] border border-border bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} aria-label={`QR code for ${url}`} role="img" />
            <a href={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`} download={`foundmate-${event.code}.svg`} className="text-sm font-medium text-brand-ink hover:underline">
              Download QR code (SVG)
            </a>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
