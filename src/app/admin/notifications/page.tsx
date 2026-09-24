import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Muted, formatDate } from "@/components/admin/data-table";
import { requireAdminPage } from "@/server/auth/session";
import { broadcastAudienceCounts, recentBroadcasts } from "@/server/admin/broadcast";
import { USER_ROLES, USER_ROLE_LABELS } from "@/lib/domain";
import { BroadcastForm } from "./broadcast-form";
import { broadcastAction } from "./actions";

export const metadata = { title: "Broadcast" };

export default async function AdminNotificationsPage() {
  await requireAdminPage("notifications.broadcast");
  const [counts, recent] = await Promise.all([broadcastAudienceCounts(), recentBroadcasts()]);
  const audiences = [{ value: "all", label: "All active members" }, ...USER_ROLES.map((r) => ({ value: r, label: `${USER_ROLE_LABELS[r]}s` }))];

  return (
    <>
      <PageHeader title="Broadcast" description="Send an in-app announcement to every active member or one role. Use sparingly — members trust notifications that matter." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent>
            <BroadcastForm audiences={audiences} counts={counts} action={broadcastAction} />
          </CardContent>
        </Card>
        <section className="lg:col-span-2">
          <SectionHeader title="Recent broadcasts" />
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Nothing sent yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-[16px] border border-border bg-card">
              {recent.map((b) => {
                const m = (b.metadata ?? {}) as { title?: string; audience?: string; sent?: number };
                return (
                  <li key={b.id} className="px-4 py-3">
                    <p className="text-[13.5px] font-medium">{m.title ?? "Untitled"}</p>
                    <Muted>
                      {(m.sent ?? 0).toLocaleString()} sent · {m.audience === "all" ? "everyone" : (m.audience ?? "").replace("role:", "")} · {b.actorName ?? "admin"} ·{" "}
                      {formatDate(b.createdAt, true)}
                    </Muted>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
