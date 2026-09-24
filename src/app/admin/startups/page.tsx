import Link from "next/link";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DemoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminActionButton } from "@/components/admin/admin-action";
import { DataTable, FilterTabs, Muted, Pagination, SearchForm, formatDate } from "@/components/admin/data-table";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { STARTUP_FILTERS, listStartups } from "@/server/admin/startups";
import { param, parsePage, pickEnum, type AdminSearchParams } from "@/server/admin/utils";
import { STAGE_LABELS } from "@/lib/domain";
import { deleteStartupAction, hideStartupAction, restoreStartupAction } from "./actions";

export const metadata = { title: "Startups" };

type Row = Awaited<ReturnType<typeof listStartups>>["rows"][number];

export default async function AdminStartupsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("startups.moderate");
  const sp = await searchParams;
  const filter = pickEnum(param(sp, "filter"), STARTUP_FILTERS, "live");
  const q = param(sp, "q")?.slice(0, 100);
  const page = parsePage(sp.page);
  const { rows, total } = await listStartups({ filter, q, page });

  return (
    <>
      <PageHeader title="Startups" description="Hide startups from discovery, restore them, or remove them." />
      <SearchForm basePath="/admin/startups" params={sp} placeholder="Search name, slug or tagline" keep={["filter"]} />
      <FilterTabs basePath="/admin/startups" params={sp} paramKey="filter" current={filter} options={STARTUP_FILTERS.map((f) => ({ value: f, label: statusLabel(f) }))} />
      <DataTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={<Rocket />} title="No startups here" description={q ? "Nothing matches that search." : "Startups show up here once founders create them."} />}
        columns={[
          {
            key: "name",
            header: "Startup",
            cell: (r) => (
              <div className="min-w-0 max-w-[340px]">
                {r.deletedAt ? (
                  <span className="font-medium">{r.name}</span>
                ) : (
                  <Link href={`/startups/${r.slug}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                )}
                {r.tagline && <p className="text-[13px] text-muted">{r.tagline}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Muted>
                    {STAGE_LABELS[r.stage]} · by{" "}
                    {r.creatorId ? (
                      <Link href={`/admin/users/${r.creatorId}`} className="hover:underline">
                        {r.creatorName ?? "unknown"}
                      </Link>
                    ) : (
                      "deleted account"
                    )}
                  </Muted>
                  {r.isDemo && <DemoBadge />}
                </div>
              </div>
            ),
          },
          {
            key: "state",
            header: "State",
            cell: (r) => (r.deletedAt ? <StatusBadge status="deleted" /> : <StatusBadge status={r.visibility} label={r.visibility === "hidden" ? "Hidden" : `Live · ${statusLabel(r.visibility)}`} />),
          },
          { key: "created", header: "Created", hideOnMobile: true, cell: (r) => <Muted>{formatDate(r.createdAt)}</Muted> },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            align: "right",
            cell: (r) => (
              <div className="flex flex-wrap justify-end gap-1.5">
                {!r.deletedAt && r.visibility !== "hidden" && (
                  <AdminActionButton
                    action={hideStartupAction}
                    payload={{ id: r.id }}
                    label="Hide…"
                    success="Startup hidden"
                    confirm={{ title: `Hide ${r.name}?`, description: "It disappears from discovery, search and recommendations. The team keeps access.", confirmLabel: "Hide", fields: [{ name: "reason", label: "Reason", type: "textarea" }] }}
                  />
                )}
                {(r.deletedAt || r.visibility === "hidden") && (
                  <AdminActionButton action={restoreStartupAction} payload={{ id: r.id }} label="Restore" success="Startup restored" />
                )}
                {!r.deletedAt && (
                  <AdminActionButton
                    action={deleteStartupAction}
                    payload={{ id: r.id }}
                    label="Delete…"
                    variant="ghost"
                    success="Startup deleted"
                    confirm={{
                      title: `Delete ${r.name}?`,
                      description: "Soft delete: the startup is removed everywhere but kept in the database, so it can be restored from the Deleted tab.",
                      confirmLabel: "Delete startup",
                      destructive: true,
                      fields: [{ name: "reason", label: "Reason", type: "textarea", required: true }],
                    }}
                  />
                )}
              </div>
            ),
          },
        ]}
      />
      <Pagination basePath="/admin/startups" params={sp} page={page} total={total} />
    </>
  );
}
