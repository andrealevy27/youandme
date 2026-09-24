import Link from "next/link";
import { Briefcase } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminActionButton } from "@/components/admin/admin-action";
import { DataTable, FilterTabs, Muted, Pagination, SearchForm, formatDate } from "@/components/admin/data-table";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { hasAdminPermission } from "@/server/authz/admin";
import { listConsultants } from "@/server/admin/consultants";
import { param, parsePage, pickEnum, type AdminSearchParams } from "@/server/admin/utils";
import { formatMoney } from "@/lib/utils";
import { reviewConsultantAction, setConsultantFeaturedAction } from "./actions";

export const metadata = { title: "Consultants" };

const FILTERS = ["pending_review", "approved", "rejected", "suspended", "draft", "all"] as const;

type Row = Awaited<ReturnType<typeof listConsultants>>["rows"][number];

export default async function AdminConsultantsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const viewer = await requireAdminPage("consultants.review");
  const canFeature = hasAdminPermission(viewer.adminRole, "featured.manage");
  const sp = await searchParams;
  const status = pickEnum(param(sp, "status"), FILTERS, "pending_review");
  const q = param(sp, "q")?.slice(0, 100);
  const page = parsePage(sp.page);
  const { rows, total, pendingCount } = await listConsultants({ status, q, page });

  const reasonField = { name: "reason", label: "Reason", type: "textarea" as const, required: true, hint: "Shared with the consultant." };

  return (
    <>
      <PageHeader title="Consultants" description="Review new consultant profiles before they can be booked." />
      <SearchForm basePath="/admin/consultants" params={sp} placeholder="Search name, headline or email" keep={["status"]} />
      <FilterTabs
        basePath="/admin/consultants"
        params={sp}
        paramKey="status"
        current={status}
        options={FILTERS.map((s) => ({ value: s, label: s === "pending_review" ? "Review queue" : statusLabel(s), count: s === "pending_review" ? pendingCount : undefined }))}
      />
      <DataTable<Row>
        rows={rows}
        rowKey={(r) => r.userId}
        empty={
          <EmptyState
            icon={<Briefcase />}
            title={status === "pending_review" ? "The review queue is clear" : "No consultants here"}
            description={status === "pending_review" ? "New consultant profiles appear here when they're submitted for review." : "Try another filter or search."}
            action={status !== "all" ? <Link className="text-sm font-medium text-brand-ink hover:underline" href="/admin/consultants?status=all">View all consultants</Link> : undefined}
          />
        }
        columns={[
          {
            key: "who",
            header: "Consultant",
            cell: (r) => (
              <div className="min-w-0 max-w-[340px]">
                <Link href={`/admin/users/${r.userId}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <p className="text-[13px] text-muted">{r.headline}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Muted>{r.email}</Muted>
                  {r.isDemo && <DemoBadge />}
                  {r.featured && <Badge variant="brand">Featured</Badge>}
                </div>
              </div>
            ),
          },
          {
            key: "meta",
            header: "Details",
            hideOnMobile: true,
            cell: (r) => (
              <div className="text-[12.5px] text-muted">
                <p>{r.hourlyRateCents ? `${formatMoney(r.hourlyRateCents, r.currency)}/hr` : "No hourly rate"}</p>
                <p>{r.reviewCount ? `${r.ratingAvg?.toFixed(1)} ★ · ${r.reviewCount} reviews` : "No reviews"}</p>
                <p>{r.stripeChargesEnabled ? "Payouts connected" : "Payouts not connected"}</p>
              </div>
            ),
          },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "updated", header: "Updated", hideOnMobile: true, cell: (r) => <Muted>{formatDate(r.updatedAt)}</Muted> },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            align: "right",
            cell: (r) => (
              <div className="flex flex-wrap justify-end gap-1.5">
                {(r.status === "pending_review" || r.status === "rejected" || r.status === "suspended") && (
                  <AdminActionButton
                    action={reviewConsultantAction}
                    payload={{ userId: r.userId, decision: "approved" }}
                    label={r.status === "suspended" ? "Reinstate" : "Approve"}
                    variant="primary"
                    success="Consultant approved"
                  />
                )}
                {r.status === "pending_review" && (
                  <AdminActionButton
                    action={reviewConsultantAction}
                    payload={{ userId: r.userId, decision: "rejected" }}
                    label="Reject…"
                    success="Consultant rejected"
                    confirm={{ title: `Reject ${r.name}?`, description: "They'll be told what to change and can resubmit.", confirmLabel: "Reject", destructive: true, fields: [reasonField] }}
                  />
                )}
                {r.status === "approved" && (
                  <AdminActionButton
                    action={reviewConsultantAction}
                    payload={{ userId: r.userId, decision: "suspended" }}
                    label="Suspend…"
                    variant="ghost"
                    success="Consultant suspended"
                    confirm={{ title: `Suspend ${r.name}'s listing?`, description: "Their consultant profile is hidden and can't take new bookings. Existing bookings are unaffected.", confirmLabel: "Suspend", destructive: true, fields: [reasonField] }}
                  />
                )}
                {canFeature && r.status === "approved" && (
                  <AdminActionButton
                    action={setConsultantFeaturedAction}
                    payload={{ userId: r.userId, featured: !r.featured }}
                    label={r.featured ? "Unfeature" : "Feature"}
                    variant="ghost"
                    success={r.featured ? "No longer featured" : "Consultant featured"}
                  />
                )}
              </div>
            ),
          },
        ]}
      />
      <Pagination basePath="/admin/consultants" params={sp} page={page} total={total} />
    </>
  );
}
