import { Mail, Ticket } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";
import { AdminActionButton, AdminActionForm, AdminActionSwitch } from "@/components/admin/admin-action";
import { DataTable, FilterTabs, Muted, Pagination, formatDate } from "@/components/admin/data-table";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { hasAdminPermission } from "@/server/authz/admin";
import { getSetting } from "@/server/settings";
import { WAITLIST_STATUSES, inviteUrl, listInvites, listWaitlist } from "@/server/admin/growth";
import { inviteState, param, parsePage, pickEnum, type AdminSearchParams } from "@/server/admin/utils";
import { createInviteAction, inviteWaitlistEntryAction, revokeInviteAction, setGrowthToggleAction } from "./actions";

export const metadata = { title: "Growth" };

type WaitRow = Awaited<ReturnType<typeof listWaitlist>>["rows"][number];
type InviteRow = Awaited<ReturnType<typeof listInvites>>["rows"][number];

export default async function AdminGrowthPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const viewer = await requireAdminPage("invites.manage");
  const canWaitlist = hasAdminPermission(viewer.adminRole, "waitlist.manage");
  const sp = await searchParams;
  const wStatus = pickEnum(param(sp, "wstatus"), WAITLIST_STATUSES, "waiting");
  const wPage = parsePage(sp.page);
  const iPage = parsePage(sp.ipage);
  const [waitlist, invites, inviteOnly, waitlistEnabled] = await Promise.all([
    canWaitlist ? listWaitlist({ status: wStatus, page: wPage }) : null,
    listInvites(iPage),
    getSetting("invite_only"),
    getSetting("waitlist_enabled"),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader title="Growth" description="Control who can join: invite-only mode, the waitlist, and invite codes." />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Invite-only</p>
              <p className="mt-0.5 text-[13px] text-muted">New accounts need a valid invite code. Existing members are unaffected.</p>
            </div>
            <AdminActionSwitch
              action={setGrowthToggleAction}
              payload={{ key: "invite_only" }}
              checked={inviteOnly}
              label="Invite-only mode"
              success={(on) => (on ? "Invite-only is on" : "Signups are open")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Waitlist</p>
              <p className="mt-0.5 text-[13px] text-muted">Show the waitlist form so people without an invite can ask to join.</p>
            </div>
            <AdminActionSwitch
              action={setGrowthToggleAction}
              payload={{ key: "waitlist_enabled" }}
              checked={waitlistEnabled}
              disabled={!canWaitlist}
              label="Waitlist enabled"
              success={(on) => (on ? "Waitlist is open" : "Waitlist is closed")}
            />
          </CardContent>
        </Card>
      </div>

      {waitlist && (
        <section className="mt-10">
          <SectionHeader title="Waitlist" description="Inviting someone creates a single-use code (valid 30 days) and emails them the link." />
          <FilterTabs
            basePath="/admin/growth"
            params={sp}
            paramKey="wstatus"
            current={wStatus}
            options={WAITLIST_STATUSES.map((s) => ({ value: s, label: statusLabel(s), count: waitlist.byStatus[s] }))}
          />
          <DataTable<WaitRow>
            rows={waitlist.rows}
            rowKey={(r) => r.id}
            empty={<EmptyState icon={<Mail />} title={`No one ${wStatus === "waiting" ? "waiting" : wStatus}`} description={waitlistEnabled ? "Sign-ups from the waitlist page appear here." : "Turn on the waitlist to start collecting sign-ups."} />}
            columns={[
              {
                key: "who",
                header: "Person",
                cell: (r) => (
                  <div className="max-w-[320px]">
                    <p className="font-medium break-all">{r.name ?? r.email}</p>
                    {r.name && <Muted>{r.email}</Muted>}
                    {(r.intent || r.note) && <p className="mt-1 text-[12.5px] text-muted">{[r.intent, r.note].filter(Boolean).join(" · ")}</p>}
                  </div>
                ),
              },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "code", header: "Code", hideOnMobile: true, cell: (r) => (r.inviteCode ? <span className="font-mono text-[12.5px]">{r.inviteCode}</span> : <Muted>—</Muted>) },
              { key: "date", header: "Joined list", hideOnMobile: true, cell: (r) => <Muted>{formatDate(r.createdAt)}</Muted> },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "right",
                cell: (r) =>
                  r.status === "waiting" ? (
                    <AdminActionButton action={inviteWaitlistEntryAction} payload={{ id: r.id }} label="Send invite" variant="primary" success={`Invite emailed to ${r.email}`} />
                  ) : null,
              },
            ]}
          />
          <Pagination basePath="/admin/growth" params={sp} page={wPage} total={waitlist.total} />
        </section>
      )}

      <section className="mt-10">
        <SectionHeader title="Invite codes" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <DataTable<InviteRow>
              rows={invites.rows}
              rowKey={(r) => r.id}
              empty={<EmptyState icon={<Ticket />} title="No invite codes yet" description="Create a code to share with a community, event or person." />}
              columns={[
                {
                  key: "code",
                  header: "Code",
                  cell: (r) => (
                    <div className="max-w-[240px]">
                      <p className="font-mono text-[13px] font-semibold">{r.code}</p>
                      {(r.note || r.email) && <p className="text-[12.5px] break-all text-muted">{[r.note, r.email].filter(Boolean).join(" · ")}</p>}
                      <p className="text-[11.5px] break-all text-subtle">{inviteUrl(r.code)}</p>
                    </div>
                  ),
                },
                {
                  key: "uses",
                  header: "Uses",
                  cell: (r) => (
                    <span className="tabular-nums">
                      {r.uses} / {r.maxUses}
                    </span>
                  ),
                },
                {
                  key: "state",
                  header: "State",
                  cell: (r) => (
                    <div>
                      <StatusBadge status={inviteState(r, now)} />
                      <p className="mt-1 text-[11.5px] text-subtle">{r.expiresAt ? `${r.expiresAt <= now ? "Ended" : "Expires"} ${formatDate(r.expiresAt)}` : "No expiry"}</p>
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: <span className="sr-only">Actions</span>,
                  align: "right",
                  cell: (r) =>
                    inviteState(r, now) !== "expired" ? (
                      <AdminActionButton
                        action={revokeInviteAction}
                        payload={{ id: r.id }}
                        label="Revoke"
                        variant="ghost"
                        success={`${r.code} revoked`}
                        confirm={{ title: `Revoke ${r.code}?`, description: "The code stops working immediately. Accounts already created with it are unaffected.", confirmLabel: "Revoke", destructive: true }}
                      />
                    ) : null,
                },
              ]}
            />
            <Pagination basePath="/admin/growth" params={sp} page={iPage} total={invites.total} pageParam="ipage" />
          </div>
          <Card className="h-fit lg:col-span-2">
            <CardHeader>
              <CardTitle>New invite code</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminActionForm action={createInviteAction} submitLabel="Create code" success="Invite code created" resetOnSuccess>
                <div className="grid gap-4">
                  <Field label="Code" htmlFor="inv-code" hint="Leave blank for a random 8-character code." optional>
                    <Input id="inv-code" name="code" maxLength={32} pattern="[A-Za-z0-9\-]{4,32}" placeholder="FOUNDERS2026" className="font-mono uppercase" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Max uses" htmlFor="inv-max">
                      <Input id="inv-max" name="maxUses" type="number" min={1} max={10000} defaultValue={1} required />
                    </Field>
                    <Field label="Expires in (days)" htmlFor="inv-exp" optional>
                      <Input id="inv-exp" name="expiresInDays" type="number" min={1} max={365} placeholder="Never" />
                    </Field>
                  </div>
                  <Field label="For email" htmlFor="inv-email" hint="For your records — the code isn't locked to this address." optional>
                    <Input id="inv-email" name="email" type="email" maxLength={320} />
                  </Field>
                  <Field label="Note" htmlFor="inv-note" optional>
                    <Input id="inv-note" name="note" maxLength={200} placeholder="e.g. YC demo day" />
                  </Field>
                </div>
              </AdminActionForm>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
