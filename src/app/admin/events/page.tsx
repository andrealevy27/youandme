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
import { LocalDateTimeInput } from "@/components/admin/local-datetime-input";
import { SCHOOLS, schoolBySlug } from "@/lib/schools";
import { createEventAction } from "./actions";

export const metadata = { title: "Events" };

type Row = Awaited<ReturnType<typeof listEvents>>[number];

export default async function AdminEventsPage() {
  await requireAdminPage("events.manage");
  const rows = await listEvents();
  return (
    <>
      <PageHeader title="Events" description="Run a team hunt: create an event, put its QR code on screen, and attendees get their five people to meet." />
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
