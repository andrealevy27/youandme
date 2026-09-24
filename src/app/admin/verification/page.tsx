import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { DemoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminActionButton } from "@/components/admin/admin-action";
import { DataTable, Muted, Pagination, formatDate } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { listPendingVerifications, recentVerificationDecisions } from "@/server/admin/verification";
import { parsePage, safeLinkedIn, type AdminSearchParams } from "@/server/admin/utils";
import { VERIFICATION_LABELS } from "@/lib/domain";
import { decideVerificationAction } from "./actions";

export const metadata = { title: "Verification" };

type Row = Awaited<ReturnType<typeof listPendingVerifications>>["rows"][number];

export default async function AdminVerificationPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("verification.review");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [{ rows, total }, recent] = await Promise.all([listPendingVerifications(page), recentVerificationDecisions()]);

  return (
    <>
      <PageHeader title="Verification" description="Identity, LinkedIn and university email requests waiting for review, oldest first." />
      <DataTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={<BadgeCheck />} title="No pending requests" description="New verification requests from members will appear here." />}
        columns={[
          {
            key: "who",
            header: "Member",
            cell: (r) => (
              <div>
                <Link href={`/admin/users/${r.userId}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Muted>{r.email}</Muted>
                  {r.isDemo && <DemoBadge />}
                </div>
              </div>
            ),
          },
          { key: "type", header: "Type", cell: (r) => <span className="text-[13.5px]">{VERIFICATION_LABELS[r.type]}</span> },
          {
            key: "subject",
            header: "Checked",
            cell: (r) => {
              const href = r.type === "linkedin" ? safeLinkedIn(r.subject) : null;
              return href ? (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand-ink hover:underline">
                  {r.subject}
                </a>
              ) : (
                <span className="break-all">{r.subject ?? <Muted>—</Muted>}</span>
              );
            },
          },
          { key: "date", header: "Requested", hideOnMobile: true, cell: (r) => <Muted>{formatDate(r.createdAt, true)}</Muted> },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            align: "right",
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <AdminActionButton action={decideVerificationAction} payload={{ id: r.id, decision: "verified" }} label="Approve" variant="primary" success="Verification approved" />
                <AdminActionButton
                  action={decideVerificationAction}
                  payload={{ id: r.id, decision: "rejected" }}
                  label="Reject…"
                  success="Verification rejected"
                  confirm={{
                    title: "Reject this request?",
                    description: "The member is notified and can submit a new request.",
                    confirmLabel: "Reject",
                    destructive: true,
                    fields: [{ name: "reason", label: "Reason", type: "textarea", placeholder: "Shared with the member" }],
                  }}
                />
              </div>
            ),
          },
        ]}
      />
      <Pagination basePath="/admin/verification" params={sp} page={page} total={total} />

      {recent.length > 0 && (
        <section className="mt-10">
          <SectionHeader title="Recent decisions" />
          <ul className="divide-y divide-border rounded-[16px] border border-border bg-card">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13.5px]">
                <span>
                  <Link href={`/admin/users/${r.userId}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>{" "}
                  <span className="text-muted">· {VERIFICATION_LABELS[r.type]}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <Muted>{formatDate(r.verifiedAt ?? r.createdAt)}</Muted>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
