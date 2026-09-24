import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CalendarCheck, MessageCircle, Rocket, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { DailyBars } from "@/components/admin/daily-bars";
import { getViewer, requireAdminPage } from "@/server/auth/session";
import { hasAdminPermission } from "@/server/authz/admin";
import { visibleAdminNav } from "@/server/admin/nav";
import { getOverviewMetrics, type MoneyByCurrency } from "@/server/admin/metrics";
import { param, ratio, type AdminSearchParams } from "@/server/admin/utils";
import { BOOKING_STATUSES } from "@/lib/domain";
import { cn, formatMoney } from "@/lib/utils";

export const metadata = { title: "Overview" };

function Money({ rows }: { rows: MoneyByCurrency }) {
  if (!rows.length) return <>{formatMoney(0)}</>;
  return (
    <span className="flex flex-col gap-1">
      {rows.map((r) => (
        <span key={r.currency}>{formatMoney(r.cents, r.currency)}</span>
      ))}
    </span>
  );
}

function pct(v: number | null) {
  return v === null ? null : `${v}%`;
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  // Admins without analytics access land on the first section they can use.
  const current = await getViewer();
  if (current?.adminRole && !hasAdminPermission(current.adminRole, "analytics.read")) {
    const first = visibleAdminNav(current.adminRole)[0];
    if (first) redirect(first.href);
  }
  await requireAdminPage("analytics.read");

  const sp = await searchParams;
  const includeDemo = param(sp, "demo") === "1";
  const m = await getOverviewMetrics({ includeDemo });
  const completion = ratio(m.users.onboarded, m.users.total);
  const conversion = ratio(m.signups30d.completed, m.signups30d.started);
  const viewedRate = ratio(m.recommendations14d.viewed, m.recommendations14d.generated);
  const actedRate = ratio(m.recommendations14d.actedOn, m.recommendations14d.viewed);
  const totalBookings = Object.values(m.bookingsByStatus).reduce((a, b) => a + b, 0);
  const signups30 = m.signupsByDay.reduce((a, d) => a + d.count, 0);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Live numbers from the You&Me database. Nothing here is estimated."
        actions={
          <Link
            href={includeDemo ? "/admin" : "/admin?demo=1"}
            role="switch"
            aria-checked={includeDemo}
            className="inline-flex h-9 items-center gap-2.5 rounded-[10px] border border-border-strong bg-card px-3 text-[13px] font-medium hover:bg-surface"
          >
            <span className={cn("relative inline-flex h-5 w-8 rounded-full transition-colors", includeDemo ? "bg-brand" : "bg-border-strong")} aria-hidden>
              <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform", includeDemo ? "translate-x-3.5" : "translate-x-0.5")} />
            </span>
            Include demo data
          </Link>
        }
      />
      {!includeDemo && (
        <p className="-mt-3 mb-5 text-[13px] text-subtle">Demo accounts and demo startups are excluded.</p>
      )}

      <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Members</h2>
      <StatGrid>
        <StatCard label="Total users" value={m.users.total.toLocaleString()} icon={<Users />} />
        <StatCard label="Active · 7 days" value={m.users.active7d.toLocaleString()} hint={pct(ratio(m.users.active7d, m.users.total)) ? `${pct(ratio(m.users.active7d, m.users.total))} of members` : undefined} icon={<Activity />} />
        <StatCard label="Active · 30 days" value={m.users.active30d.toLocaleString()} hint={pct(ratio(m.users.active30d, m.users.total)) ? `${pct(ratio(m.users.active30d, m.users.total))} of members` : undefined} />
        <StatCard label="Profile completion" value={pct(completion)} hint={`${m.users.onboarded.toLocaleString()} finished onboarding`} />
        <StatCard label="Founders" value={m.founders.toLocaleString()} icon={<Rocket />} />
        <StatCard
          label="Consultants approved"
          value={m.consultants.approved.toLocaleString()}
          hint={m.consultants.pending ? <Link className="text-warning underline-offset-2 hover:underline" href="/admin/consultants">{m.consultants.pending} pending review</Link> : "None pending review"}
        />
        <StatCard label="Startups" value={m.startups.toLocaleString()} />
        <StatCard label="Cofounder matches" value={m.matches.toLocaleString()} icon={<Sparkles />} />
        <StatCard label="Conversations" value={m.conversations.toLocaleString()} icon={<MessageCircle />} />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>New members · last 30 days</CardTitle>
              <p className="mt-0.5 text-[13px] text-muted">{signups30.toLocaleString()} profiles created</p>
            </div>
          </CardHeader>
          <CardContent>
            {signups30 === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No new members in the last 30 days{includeDemo ? "" : " (excluding demo data)"}.</p>
            ) : (
              <DailyBars data={m.signupsByDay} label="New members per day" />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funnels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[13px] font-medium">Signup conversion · 30 days</p>
                <p className="text-lg font-semibold tabular-nums">{pct(conversion) ?? <span className="text-subtle">—</span>}</p>
              </div>
              <p className="mt-1 text-[12.5px] text-subtle">
                {m.signups30d.completed.toLocaleString()} completed of {m.signups30d.started.toLocaleString()} started (signup_started → signup_completed events)
              </p>
            </div>
            <div>
              <p className="text-[13px] font-medium">Daily recommendations · 14 days</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "Generated", v: m.recommendations14d.generated.toLocaleString(), s: null },
                  { k: "Viewed", v: m.recommendations14d.viewed.toLocaleString(), s: pct(viewedRate) },
                  { k: "Acted on", v: m.recommendations14d.actedOn.toLocaleString(), s: pct(actedRate) },
                ].map((x) => (
                  <div key={x.k} className="rounded-[12px] bg-surface px-2 py-2.5">
                    <dt className="text-[11.5px] text-muted">{x.k}</dt>
                    <dd className="mt-0.5 text-[17px] font-semibold tabular-nums">{x.v}</dd>
                    <dd className="text-[11.5px] text-subtle">{x.s ? (x.k === "Viewed" ? `${x.s} of generated` : `${x.s} of viewed`) : " "}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Marketplace</h2>
      <StatGrid>
        <StatCard label="Bookings" value={totalBookings.toLocaleString()} icon={<CalendarCheck />} />
        <StatCard label="Booking GMV" value={<Money rows={m.gmv} />} hint="Confirmed + completed bookings" />
        <StatCard label="Platform revenue (net)" value={<Money rows={m.revenue.net} />} tone="brand" hint="Fees on paid bookings minus refunded fees" />
        <StatCard
          label="Refunded fees"
          value={<Money rows={m.revenue.refunded} />}
          hint={m.revenue.gross.length ? <>Gross fees: <Money rows={m.revenue.gross} /></> : "No paid bookings yet"}
        />
      </StatGrid>
      <Card className="mt-4">
        <CardContent className="flex flex-wrap gap-2">
          {BOOKING_STATUSES.map((s) => (
            <Link key={s} href={`/admin/bookings?status=${s}`} className="inline-flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-[13px] hover:bg-surface">
              <StatusBadge status={s} />
              <span className="font-semibold tabular-nums">{m.bookingsByStatus[s].toLocaleString()}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
