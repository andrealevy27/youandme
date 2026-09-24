import Link from "next/link";
import { Flag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminActionButton } from "@/components/admin/admin-action";
import { FilterTabs, JsonDetails, Muted, Pagination, formatDate } from "@/components/admin/data-table";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { REMOVABLE_TARGETS, REPORT_STATUSES, listReports } from "@/server/admin/reports";
import { param, parsePage, pickEnum, type AdminSearchParams } from "@/server/admin/utils";
import { REPORT_REASON_LABELS } from "@/lib/domain";
import { actionReportAction, dismissReportAction, markReportReviewingAction, removeReportedContentAction } from "./actions";

export const metadata = { title: "Reports" };

const REMOVE_LABEL: Record<(typeof REMOVABLE_TARGETS)[number], string> = {
  message: "Remove message",
  review: "Hide review",
  startup: "Hide startup",
};

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("reports.handle");
  const sp = await searchParams;
  const status = pickEnum(param(sp, "status"), REPORT_STATUSES, "open");
  const page = parsePage(sp.page);
  const { rows, total, byStatus } = await listReports({ status, page });
  const resolvable = status === "open" || status === "reviewing";

  return (
    <>
      <PageHeader title="Reports" description="Member reports, oldest first. Every decision is recorded in the audit log." />
      <FilterTabs basePath="/admin/reports" params={sp} paramKey="status" current={status} options={REPORT_STATUSES.map((s) => ({ value: s, label: statusLabel(s), count: byStatus[s] }))} />

      {rows.length === 0 ? (
        <EmptyState icon={<Flag />} title={resolvable ? "Nothing to review" : `No ${status} reports`} description={resolvable ? "New reports from members land here." : "Resolved reports appear here for reference."} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const removable = (REMOVABLE_TARGETS as readonly string[]).includes(r.targetType);
            const personTarget = r.targetType === "user" || r.targetType === "consultant";
            return (
              <li key={r.id} className="rounded-[16px] border border-border bg-card p-4 shadow-soft sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{statusLabel(r.targetType)}</Badge>
                      <span className="text-[14px] font-semibold">{REPORT_REASON_LABELS[r.reason]}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-1 text-[12.5px] text-subtle">
                      Reported by{" "}
                      {r.reporterId ? (
                        <Link href={`/admin/users/${r.reporterId}`} className="hover:underline">
                          {r.reporterName ?? "unknown"}
                        </Link>
                      ) : (
                        "a deleted account"
                      )}{" "}
                      · {formatDate(r.createdAt, true)}
                      {r.resolvedAt && <> · resolved {formatDate(r.resolvedAt, true)}</>}
                    </p>
                    {r.details && <p className="mt-2 text-[13.5px] whitespace-pre-wrap">{r.details}</p>}
                    {r.resolution && (
                      <p className="mt-2 rounded-[10px] bg-surface px-3 py-2 text-[13px]">
                        <span className="font-medium">Resolution:</span> {r.resolution}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <JsonDetails value={r.snapshot} summary="Content snapshot" />
                      <Muted>Target id: {r.targetId}</Muted>
                      {personTarget && (
                        <Link href={`/admin/users/${r.targetId}`} className="text-[12.5px] font-medium text-brand-ink hover:underline">
                          Open member actions →
                        </Link>
                      )}
                    </div>
                  </div>
                  {resolvable && (
                    <div className="flex shrink-0 flex-wrap gap-1.5 sm:max-w-[280px] sm:justify-end">
                      {r.status === "open" && <AdminActionButton action={markReportReviewingAction} payload={{ id: r.id }} label="Start review" variant="ghost" />}
                      {removable && (
                        <AdminActionButton
                          action={removeReportedContentAction}
                          payload={{ id: r.id }}
                          label={`${REMOVE_LABEL[r.targetType as (typeof REMOVABLE_TARGETS)[number]]}…`}
                          variant="danger"
                          success="Content removed and report actioned"
                          confirm={{
                            title: REMOVE_LABEL[r.targetType as (typeof REMOVABLE_TARGETS)[number]],
                            description: "The content is taken down and this report is marked actioned.",
                            confirmLabel: "Remove",
                            destructive: true,
                            fields: [{ name: "resolution", label: "Resolution note", type: "textarea", required: true }],
                          }}
                        />
                      )}
                      <AdminActionButton
                        action={actionReportAction}
                        payload={{ id: r.id }}
                        label="Mark actioned…"
                        success="Report actioned"
                        confirm={{
                          title: "Mark as actioned",
                          description: personTarget ? "Record what you did (e.g. suspended the account from the member page)." : "Record what was done about this report.",
                          confirmLabel: "Mark actioned",
                          fields: [{ name: "resolution", label: "Resolution note", type: "textarea", required: true }],
                        }}
                      />
                      <AdminActionButton
                        action={dismissReportAction}
                        payload={{ id: r.id }}
                        label="Dismiss…"
                        variant="ghost"
                        success="Report dismissed"
                        confirm={{ title: "Dismiss this report?", description: "Use this when no rule was broken.", confirmLabel: "Dismiss", fields: [{ name: "note", label: "Note", type: "textarea" }] }}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination basePath="/admin/reports" params={sp} page={page} total={total} />
    </>
  );
}
