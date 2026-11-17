import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { AdminActionForm } from "@/components/admin/admin-action";
import { DataTable, Muted } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { formatEventTime, listEvents } from "@/server/events";
import { getEventFunnel, getPartnerOverview } from "@/server/events/dashboard";
import { StatCard } from "@/components/admin/stat-card";
import { LocalDateTimeInput } from "@/components/admin/local-datetime-input";
import { SCHOOLS, schoolBySlug } from "@/lib/schools";
import { createEventAction } from "./actions";

export const metadata = { title: "Events" };

type Row = Awaited<ReturnType<typeof listEvents>>[number] & { funnel: Awaited<ReturnType<typeof getEventFunnel>> };

export default async function AdminEventsPage() {
  await requireAdminPage("events.manage");
  const [events, overview] = await Promise.all([listEvents(), getPartnerOverview()]);
  const rows: Row[] = await Promise.all(events.map(async (r) => ({ ...r, funnel: await getEventFunnel(r.event.id) })));
  return (
    <>
      <PageHeader title="Events" description="Run a team hunt: create an event, put its QR code on screen, and attendees get their five people to meet." />
      <section aria-label="Partner dashboard" className="mb-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Verified students" value={overview.verifiedStudents.reduce((a, s) => a + s.n, 0)} hint={overview.verifiedStudents.map((s) => `${s.school} ${s.n}`).join(" · ")} />
          <StatCard label="Event attendees" value={overview.attendees} hint={`across ${overview.events} event${overview.events === 1 ? "" : "s"}`} />
          <StatCard label="Matches at events" value={overview.eventMatches} hint="Both said yes" tone="brand" />
          <StatCard label="Cofounder trials" value={overview.trialsStarted} hint={`${overview.trialsContinuing} continuing after 2 weeks`} />
        </div>
        <p className="mt-2 text-[12.5px] text-subtle">Counts only — safe to share with a partner. No names or profiles appear here.</p>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <DataTable<Row>
          rows={rows}
          rowKey={(r) => r.event.id}
          empty={<EmptyState icon={<CalendarPlus />} title="No events yet" description="Create your first event with the form." />}
          columns={[
            {
              key: "name",
              header: "Event",
              cell: (r) => (
                <Link href={`/admin/events/${r.event.id}`} className="font-medium hover:underline">
                  {r.event.name}
                </Link>
              ),
            },
            { key: "date", header: "Date", cell: (r) => <Muted>{formatEventTime(r.event)}</Muted>, hideOnMobile: true },
            { key: "school", header: "School", cell: (r) => <Muted>{schoolBySlug(r.event.school)?.shortName ?? "Any"}</Muted>, hideOnMobile: true },
            { key: "people", header: "Attendees", cell: (r) => <span className="tabular-nums">{r.attendees}</span>, align: "right" },
            { key: "matches", header: "Matches", cell: (r) => <span className="tabular-nums">{r.funnel.matches}</span>, align: "right", hideOnMobile: true },
            { key: "trials", header: "Trials", cell: (r) => <span className="tabular-nums">{r.funnel.trialsStarted}</span>, align: "right", hideOnMobile: true },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.event.status} />, align: "right" },
          ]}
        />
        <Card>
          <CardHeader>
            <CardTitle>New event</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminActionForm action={createEventAction} submitLabel="Create event" success="Event created." resetOnSuccess className="space-y-4">
              <Field label="Name" htmlFor="ev-name">
                <Input id="ev-name" name="name" required maxLength={120} placeholder="Startup Team Hunt — Spring" />
              </Field>
              <Field label="Date and time" htmlFor="ev-date">
                <LocalDateTimeInput id="ev-date" name="startsAt" />
              </Field>
              <Field label="School" htmlFor="ev-school">
                <NativeSelect id="ev-school" name="school" defaultValue="">
                  <option value="">Any school (cross-campus)</option>
                  {SCHOOLS.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name} students only
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Location (optional)" htmlFor="ev-loc">
                <Input id="ev-loc" name="location" maxLength={160} placeholder="Leslie eLab, 16 Washington Pl" />
              </Field>
              <Field label="Description (optional)" htmlFor="ev-desc">
                <Textarea id="ev-desc" name="description" rows={3} maxLength={1000} />
              </Field>
            </AdminActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
