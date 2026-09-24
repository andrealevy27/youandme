import Link from "next/link";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DemoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminActionButton } from "@/components/admin/admin-action";
import { DataTable, FilterTabs, Muted, Pagination, formatDate } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { listReviews } from "@/server/admin/reviews";
import { param, parsePage, pickEnum, type AdminSearchParams } from "@/server/admin/utils";
import { setReviewStatusAction } from "./actions";

export const metadata = { title: "Reviews" };

const FILTERS = ["published", "hidden", "all"] as const;
type Row = Awaited<ReturnType<typeof listReviews>>["rows"][number];

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("reviews.moderate");
  const sp = await searchParams;
  const status = pickEnum(param(sp, "status"), FILTERS, "published");
  const page = parsePage(sp.page);
  const { rows, total } = await listReviews({ status, page });

  return (
    <>
      <PageHeader title="Reviews" description="Hiding a review removes it from the consultant's profile and recalculates their rating." />
      <FilterTabs basePath="/admin/reviews" params={sp} paramKey="status" current={status} options={FILTERS.map((f) => ({ value: f, label: f[0]!.toUpperCase() + f.slice(1) }))} />
      <DataTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={<Star />} title="No reviews here" description="Reviews appear after clients complete a booking and rate it." />}
        columns={[
          {
            key: "rating",
            header: "Rating",
            cell: (r) => (
              <div>
                <p className="font-semibold tabular-nums">{r.overall} ★</p>
                <Muted>
                  E{r.expertise} · C{r.communication} · V{r.value} · R{r.reliability}
                </Muted>
              </div>
            ),
          },
          {
            key: "body",
            header: "Review",
            cell: (r) => (
              <div className="max-w-[420px]">
                {r.body ? <p className="text-[13.5px] whitespace-pre-wrap">{r.body}</p> : <Muted>No written review</Muted>}
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-subtle">
                  <span>
                    {r.reviewerName ?? "Deleted account"} →{" "}
                    <Link href={`/admin/users/${r.consultantId}`} className="hover:underline">
                      {r.consultantName ?? "consultant"}
                    </Link>
                  </span>
                  {r.isDemo && <DemoBadge />}
                </p>
              </div>
            ),
          },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "date", header: "Date", hideOnMobile: true, cell: (r) => <Muted>{formatDate(r.createdAt)}</Muted> },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            align: "right",
            cell: (r) =>
              r.status === "published" ? (
                <AdminActionButton
                  action={setReviewStatusAction}
                  payload={{ id: r.id, status: "hidden" }}
                  label="Hide…"
                  success="Review hidden"
                  confirm={{ title: "Hide this review?", description: "It's removed from the consultant's profile and their rating is recalculated.", confirmLabel: "Hide review", destructive: true, fields: [{ name: "reason", label: "Reason", type: "textarea" }] }}
                />
              ) : (
                <AdminActionButton action={setReviewStatusAction} payload={{ id: r.id, status: "published" }} label="Unhide" success="Review published again" />
              ),
          },
        ]}
      />
      <Pagination basePath="/admin/reviews" params={sp} page={page} total={total} />
    </>
  );
}
