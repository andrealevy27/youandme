import Link from "next/link";
import { CalendarCheck, CreditCard } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminActionButton } from "@/components/admin/admin-action";
import { DataTable, FilterTabs, Muted, Pagination, formatDate } from "@/components/admin/data-table";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { hasAdminPermission } from "@/server/authz/admin";
import { listBookings, listPayments } from "@/server/admin/bookings";
import { refundsAvailable } from "@/server/admin/refunds";
import { param, parsePage, pickEnum, type AdminSearchParams } from "@/server/admin/utils";
import { BOOKING_STATUSES } from "@/lib/domain";
import { formatMoney } from "@/lib/utils";
import { refundBookingAction } from "./actions";

export const metadata = { title: "Bookings" };

const FILTERS = ["all", ...BOOKING_STATUSES] as const;
type BookingRow = Awaited<ReturnType<typeof listBookings>>["rows"][number];
type PaymentRow = Awaited<ReturnType<typeof listPayments>>["rows"][number];

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const viewer = await requireAdminPage("bookings.read");
  const canSeePayments = hasAdminPermission(viewer.adminRole, "payments.read");
  const canRefund = hasAdminPermission(viewer.adminRole, "payments.refund");
  const sp = await searchParams;
  const status = pickEnum(param(sp, "status"), FILTERS, "all");
  const page = parsePage(sp.page);
  const paymentsPage = parsePage(sp.ppage);
  const [bookings, payments, refundReady] = await Promise.all([
    listBookings({ status, page }),
    canSeePayments ? listPayments(paymentsPage) : null,
    canRefund ? refundsAvailable() : false,
  ]);

  return (
    <>
      <PageHeader title="Bookings & payments" description="Consultant bookings with price snapshots, and the payment records behind them." />
      <FilterTabs basePath="/admin/bookings" params={sp} paramKey="status" current={status} options={FILTERS.map((s) => ({ value: s, label: statusLabel(s) }))} />
      <DataTable<BookingRow>
        rows={bookings.rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={<CalendarCheck />} title="No bookings" description={status === "all" ? "Bookings appear here once founders book consultants." : "No bookings with this status."} />}
        columns={[
          {
            key: "service",
            header: "Booking",
            cell: (r) => (
              <div className="max-w-[300px]">
                <p className="font-medium">{r.serviceTitle}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-subtle">
                  <Link href={`/admin/users/${r.clientId}`} className="hover:underline">
                    {r.clientName ?? "client"}
                  </Link>
                  →
                  <Link href={`/admin/users/${r.consultantId}`} className="hover:underline">
                    {r.consultantName ?? "consultant"}
                  </Link>
                  {r.isDemo && <DemoBadge />}
                </p>
              </div>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            cell: (r) => (
              <div className="tabular-nums">
                <p className="font-medium">{formatMoney(r.amountCents, r.currency)}</p>
                <Muted>fee {formatMoney(r.platformFeeCents, r.currency)}</Muted>
              </div>
            ),
          },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "when", header: "Session", hideOnMobile: true, cell: (r) => <Muted>{formatDate(r.startsAt, true)}</Muted> },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            align: "right",
            cell: (r) => {
              if (!canRefund || (r.status !== "confirmed" && r.status !== "completed")) return null;
              if (!refundReady) {
                return (
                  <Button size="sm" variant="secondary" disabled title="Refunds require payments service">
                    Refunds require payments service
                  </Button>
                );
              }
              return (
                <AdminActionButton
                  action={refundBookingAction}
                  payload={{ bookingId: r.id }}
                  label="Refund…"
                  variant="ghost"
                  success="Refund issued"
                  confirm={{
                    title: "Refund this booking?",
                    description: `${formatMoney(r.amountCents, r.currency)} goes back to ${r.clientName ?? "the client"} through the payment provider. This can't be undone.`,
                    confirmLabel: "Issue refund",
                    destructive: true,
                  }}
                />
              );
            },
          },
        ]}
      />
      <Pagination basePath="/admin/bookings" params={sp} page={page} total={bookings.total} />

      {payments && (
        <section className="mt-10">
          <SectionHeader title="Payments" description="Provider references only — card details are never stored." />
          <DataTable<PaymentRow>
            rows={payments.rows}
            rowKey={(r) => r.id}
            empty={<EmptyState icon={<CreditCard />} title="No payments yet" description="Payment records are created when a client checks out." />}
            columns={[
              {
                key: "provider",
                header: "Provider",
                cell: (r) => (
                  <div className="max-w-[260px]">
                    <p className="font-medium capitalize">{r.provider}</p>
                    <p className="font-mono text-[11.5px] break-all text-subtle">{r.providerPaymentId ?? r.providerCheckoutId ?? "—"}</p>
                  </div>
                ),
              },
              { key: "payer", header: "Payer", hideOnMobile: true, cell: (r) => r.payerName ?? <Muted>—</Muted> },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                cell: (r) => (
                  <div className="tabular-nums">
                    <p className="font-medium">{formatMoney(r.amountCents, r.currency)}</p>
                    <Muted>fee {formatMoney(r.applicationFeeCents, r.currency)}</Muted>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <div>
                    <StatusBadge status={r.status} />
                    {r.failureReason && <p className="mt-1 text-[12px] text-danger">{r.failureReason}</p>}
                  </div>
                ),
              },
              { key: "date", header: "Created", hideOnMobile: true, cell: (r) => <Muted>{formatDate(r.createdAt, true)}</Muted> },
              { key: "booking", header: "Booking", hideOnMobile: true, cell: (r) => <span className="font-mono text-[11.5px] text-subtle">{r.bookingId.slice(0, 8)}</span> },
            ]}
          />
          <Pagination basePath="/admin/bookings" params={sp} page={paymentsPage} total={payments.total} pageParam="ppage" />
        </section>
      )}
    </>
  );
}
