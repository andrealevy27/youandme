import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, FilterTabs, Muted, Pagination, SearchForm, formatDate } from "@/components/admin/data-table";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { listUsers, type AdminUserRow } from "@/server/admin/users";
import { param, parsePage, pickEnum, type AdminSearchParams } from "@/server/admin/utils";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/domain";

export const metadata = { title: "Users" };

const STATUS_FILTERS = ["all", "active", "suspended", "banned", "deleted"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("users.read");
  const sp = await searchParams;
  const q = param(sp, "q")?.slice(0, 100);
  const status = pickEnum(param(sp, "status"), STATUS_FILTERS, "all");
  const page = parsePage(sp.page);
  const { rows, total } = await listUsers({ q, status, page });

  return (
    <>
      <PageHeader title="Users" description="Every member account. Search by name, email or handle." />
      <SearchForm basePath="/admin/users" params={sp} placeholder="Search name, email or handle" keep={["status"]} />
      <FilterTabs basePath="/admin/users" params={sp} paramKey="status" current={status} options={STATUS_FILTERS.map((s) => ({ value: s, label: statusLabel(s) }))} />
      <DataTable<AdminUserRow>
        rows={rows}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={<Users />}
            title={q ? "No members match that search" : "No members here yet"}
            description={q ? "Try part of their name, their email address, or their @handle." : "Accounts appear here as soon as people sign up."}
          />
        }
        columns={[
          {
            key: "name",
            header: "Member",
            cell: (r) => (
              <div className="min-w-0">
                <Link href={`/admin/users/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Muted>@{r.handle}</Muted>
                  {r.isDemo && <DemoBadge />}
                  {r.featured && <Badge variant="brand">Featured</Badge>}
                </div>
              </div>
            ),
          },
          { key: "email", header: "Email", cell: (r) => <span className="break-all">{r.email}</span> },
          {
            key: "roles",
            header: "Roles",
            hideOnMobile: true,
            cell: (r) => (
              <div className="flex max-w-[260px] flex-wrap gap-1">
                {r.adminRole && <Badge variant="outline">Admin · {statusLabel(r.adminRole)}</Badge>}
                {r.roles.map((role) => (
                  <Badge key={role}>{USER_ROLE_LABELS[role as UserRole] ?? role}</Badge>
                ))}
                {!r.adminRole && !r.roles.length && <Muted>—</Muted>}
              </div>
            ),
          },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "joined", header: "Joined", hideOnMobile: true, cell: (r) => <Muted>{formatDate(r.joinedAt)}</Muted> },
        ]}
      />
      <Pagination basePath="/admin/users" params={sp} page={page} total={total} />
    </>
  );
}
