import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, JsonDetails, Muted, Pagination, SearchForm, formatDate } from "@/components/admin/data-table";
import { requireAdminPage } from "@/server/auth/session";
import { listAuditLogs } from "@/server/admin/audit-log";
import { param, parsePage, type AdminSearchParams } from "@/server/admin/utils";

export const metadata = { title: "Audit log" };

type Row = Awaited<ReturnType<typeof listAuditLogs>>["rows"][number];

function targetHref(type: string | null, id: string | null) {
  if (!id) return null;
  if (type === "user" || type === "consultant") return `/admin/users/${id}`;
  return null;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("audit.read");
  const sp = await searchParams;
  const action = param(sp, "action")?.slice(0, 80);
  const targetId = param(sp, "target")?.slice(0, 128);
  const page = parsePage(sp.page);
  const { rows, total } = await listAuditLogs({ action, targetId, page });

  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of admin actions, permission changes, deletions and payments." />
      <SearchForm basePath="/admin/audit" params={sp} name="action" placeholder="Filter by action prefix, e.g. user. or settings." keep={["target"]} />
      {targetId && (
        <p className="-mt-2 mb-4 text-[13px] text-muted">
          Showing entries for target <span className="font-mono">{targetId}</span> ·{" "}
          <Link href="/admin/audit" className="text-brand-ink hover:underline">
            Clear
          </Link>
        </p>
      )}
      <DataTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={<ScrollText />} title="No entries" description={action || targetId ? "Nothing matches this filter." : "Admin actions will be recorded here."} />}
        columns={[
          { key: "time", header: "Time", cell: (r) => <Muted>{formatDate(r.createdAt, true)}</Muted>, className: "whitespace-nowrap" },
          {
            key: "actor",
            header: "Actor",
            cell: (r) =>
              r.actorId ? (
                <Link href={`/admin/users/${r.actorId}`} className="hover:underline">
                  {r.actorName ?? r.actorId.slice(0, 8)}
                </Link>
              ) : (
                <Muted>System</Muted>
              ),
          },
          { key: "action", header: "Action", cell: (r) => <span className="font-mono text-[12.5px]">{r.action}</span> },
          {
            key: "target",
            header: "Target",
            hideOnMobile: true,
            cell: (r) => {
              if (!r.targetType && !r.targetId) return <Muted>—</Muted>;
              const href = targetHref(r.targetType, r.targetId);
              const label = (
                <>
                  {r.targetType}
                  {r.targetId && <span className="font-mono text-subtle"> {r.targetId.slice(0, 8)}</span>}
                </>
              );
              return (
                <span className="text-[12.5px]">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </span>
              );
            },
          },
          { key: "meta", header: "Metadata", cell: (r) => <JsonDetails value={r.metadata} summary="View" /> },
        ]}
      />
      <Pagination basePath="/admin/audit" params={sp} page={page} total={total} />
    </>
  );
}
