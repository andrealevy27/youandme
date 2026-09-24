import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminActionButton } from "@/components/admin/admin-action";
import { Muted, formatDate } from "@/components/admin/data-table";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { requireAdminPage } from "@/server/auth/session";
import { hasAdminPermission } from "@/server/authz/admin";
import { getUserDetail } from "@/server/admin/users";
import { ADMIN_ROLES, REPORT_REASON_LABELS, USER_ROLE_LABELS, VERIFICATION_LABELS, type UserRole } from "@/lib/domain";
import {
  banUserAction,
  decideUserVerificationAction,
  setAdminRoleAction,
  setUserFeaturedAction,
  suspendUserAction,
  unbanUserAction,
  unsuspendUserAction,
} from "../actions";

export const metadata = { title: "Member" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-[13.5px] break-words">{children ?? <Muted>—</Muted>}</dd>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdminPage("users.read");
  const { id } = await params;
  const u = await getUserDetail(id);
  if (!u) notFound();
  const p = u.profile;
  const self = viewer.userId === p.userId;
  const can = {
    moderate: hasAdminPermission(viewer.adminRole, "users.moderate") && !self && (!u.adminRole || hasAdminPermission(viewer.adminRole, "admins.manage")),
    feature: hasAdminPermission(viewer.adminRole, "featured.manage"),
    admins: hasAdminPermission(viewer.adminRole, "admins.manage") && !self,
    verify: hasAdminPermission(viewer.adminRole, "verification.review"),
  };
  const suspendedActive = p.status === "suspended" && (!p.suspendedUntil || p.suspendedUntil > new Date());
  const pendingVerifications = u.verifications.filter((v) => v.status === "pending" && ["identity", "linkedin", "university_email"].includes(v.type));

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All users
      </Link>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={p.displayName} src={p.avatarUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-semibold tracking-tight">{p.displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Muted>@{p.handle}</Muted>
              <StatusBadge status={p.status} />
              {p.isDemo && <DemoBadge />}
              {p.featured && <Badge variant="brand">Featured</Badge>}
              {u.adminRole && <Badge variant="outline">Admin · {statusLabel(u.adminRole)}</Badge>}
              {self && <Badge>You</Badge>}
            </div>
          </div>
        </div>
        {p.status !== "deleted" && (
          <Link href={`/people/${p.handle}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink hover:underline">
            View public profile <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Email">
                  {u.email} {u.emailVerified ? <Badge variant="success">Confirmed</Badge> : <Badge variant="warning">Unconfirmed</Badge>}
                </Row>
                <Row label="Headline">{p.headline}</Row>
                <Row label="Location">{[p.city, p.country].filter(Boolean).join(", ") || p.location}</Row>
                <Row label="Roles">
                  {u.roles.length ? (
                    <span className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r}>{USER_ROLE_LABELS[r as UserRole] ?? r}</Badge>
                      ))}
                    </span>
                  ) : null}
                </Row>
                <Row label="Consultant">
                  {u.consultant ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={u.consultant.status} />
                      <Link href="/admin/consultants?status=all" className="text-brand-ink hover:underline">
                        Manage in consultants
                      </Link>
                    </span>
                  ) : null}
                </Row>
                <Row label="Visibility">{statusLabel(p.visibility)}</Row>
                <Row label="Onboarding">{p.onboardingCompletedAt ? `Completed ${formatDate(p.onboardingCompletedAt)}` : `In progress (step ${p.onboardingStep})`}</Row>
                <Row label="Joined">{formatDate(u.joinedAt, true)}</Row>
                <Row label="Last active">{formatDate(p.lastActiveAt, true)}</Row>
                <Row label="Active sessions">{u.activeSessions}</Row>
                {p.status === "suspended" && <Row label="Suspended until">{p.suspendedUntil ? formatDate(p.suspendedUntil, true) : "Until lifted"}</Row>}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verifications</CardTitle>
            </CardHeader>
            <CardContent>
              {u.verifications.length === 0 ? (
                <p className="text-sm text-muted">No verification requests.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {u.verifications.map((v) => {
                    const reviewable = pendingVerifications.some((x) => x.id === v.id);
                    return (
                      <li key={v.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium">{VERIFICATION_LABELS[v.type]}</p>
                          <Muted>
                            {v.subject ? `${v.subject} · ` : ""}requested {formatDate(v.createdAt)}
                          </Muted>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={v.status} />
                          {reviewable && can.verify && (
                            <>
                              <AdminActionButton action={decideUserVerificationAction} payload={{ id: v.id, userId: p.userId, decision: "verified" }} label="Approve" success="Verification approved" />
                              <AdminActionButton
                                action={decideUserVerificationAction}
                                payload={{ id: v.id, userId: p.userId, decision: "rejected" }}
                                label="Reject"
                                variant="ghost"
                                success="Verification rejected"
                                confirm={{
                                  title: "Reject verification?",
                                  description: "The member is notified and can submit a new request.",
                                  confirmLabel: "Reject",
                                  destructive: true,
                                  fields: [{ name: "reason", label: "Reason", type: "textarea", placeholder: "e.g. The document was unreadable." }],
                                }}
                              />
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reports against this member</CardTitle>
            </CardHeader>
            <CardContent>
              {u.reportsAgainst.length === 0 ? (
                <p className="text-sm text-muted">No reports.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {u.reportsAgainst.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium">{REPORT_REASON_LABELS[r.reason]}</span>
                        <Badge>{statusLabel(r.targetType)}</Badge>
                        <StatusBadge status={r.status} />
                        <Muted>
                          by {r.reporterName ?? "deleted account"} · {formatDate(r.createdAt)}
                        </Muted>
                      </div>
                      {r.details && <p className="mt-1 text-[13px] text-muted">{r.details}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {u.reportsAgainst.length > 0 && (
                <Link href="/admin/reports" className="mt-2 inline-block text-[13px] font-medium text-brand-ink hover:underline">
                  Open moderation queue
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Moderation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {self && <p className="text-[13px] text-muted">You can&apos;t moderate your own account.</p>}
              {!self && !can.moderate && <p className="text-[13px] text-muted">You don&apos;t have permission to moderate this account.</p>}
              {can.moderate && p.status !== "deleted" && (
                <>
                  {suspendedActive || p.status === "suspended" ? (
                    <AdminActionButton action={unsuspendUserAction} payload={{ userId: p.userId }} label="Lift suspension" success="Suspension lifted" />
                  ) : p.status === "active" ? (
                    <AdminActionButton
                      action={suspendUserAction}
                      payload={{ userId: p.userId }}
                      label="Suspend…"
                      success="Member suspended and signed out"
                      confirm={{
                        title: `Suspend ${p.displayName}?`,
                        description: "They'll be signed out everywhere and can't sign in until the suspension ends. They're notified by email.",
                        confirmLabel: "Suspend",
                        destructive: true,
                        fields: [
                          {
                            name: "days",
                            label: "Duration",
                            type: "select",
                            required: true,
                            defaultValue: "7",
                            options: [
                              { value: "1", label: "1 day" },
                              { value: "3", label: "3 days" },
                              { value: "7", label: "7 days" },
                              { value: "30", label: "30 days" },
                              { value: "90", label: "90 days" },
                              { value: "indefinite", label: "Until lifted" },
                            ],
                          },
                          { name: "reason", label: "Reason", type: "textarea", required: true, hint: "Shared with the member and saved to the audit log." },
                        ],
                      }}
                    />
                  ) : null}
                  {p.status === "banned" ? (
                    <AdminActionButton action={unbanUserAction} payload={{ userId: p.userId }} label="Reinstate account" success="Account reinstated" confirm={{ title: "Reinstate this account?", description: "They'll be able to sign in again.", confirmLabel: "Reinstate" }} />
                  ) : (
                    <AdminActionButton
                      action={banUserAction}
                      payload={{ userId: p.userId }}
                      label="Ban…"
                      variant="danger"
                      success="Member banned and signed out"
                      confirm={{
                        title: `Ban ${p.displayName}?`,
                        description: "Permanent removal from You&Me: all sessions are revoked and they can't sign in again.",
                        confirmLabel: "Ban account",
                        destructive: true,
                        fields: [{ name: "reason", label: "Reason", type: "textarea", required: true, hint: "Shared with the member and saved to the audit log." }],
                      }}
                    />
                  )}
                </>
              )}
              {can.feature && p.status === "active" && (
                <AdminActionButton
                  action={setUserFeaturedAction}
                  payload={{ userId: p.userId, featured: !p.featured }}
                  label={p.featured ? "Remove from featured" : "Feature member"}
                  variant="ghost"
                  success={p.featured ? "No longer featured" : "Member featured"}
                />
              )}
            </CardContent>
          </Card>

          {hasAdminPermission(viewer.adminRole, "admins.manage") && (
            <Card>
              <CardHeader>
                <CardTitle>Admin access</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-[13px] text-muted">
                  Current: <span className="font-medium text-foreground">{u.adminRole ? statusLabel(u.adminRole) : "None"}</span>
                </p>
                {self ? (
                  <p className="text-[13px] text-muted">You can&apos;t change your own admin role.</p>
                ) : (
                  can.admins &&
                  p.status === "active" && (
                    <>
                      <AdminActionButton
                        action={setAdminRoleAction}
                        payload={{ userId: p.userId }}
                        label={u.adminRole ? "Change role…" : "Grant admin role…"}
                        success="Admin role updated"
                        confirm={{
                          title: u.adminRole ? "Change admin role" : "Grant admin access",
                          description: "Admins act on real member data. Every change is audited.",
                          confirmLabel: "Save role",
                          fields: [
                            {
                              name: "role",
                              label: "Role",
                              type: "select",
                              required: true,
                              defaultValue: u.adminRole ?? "support",
                              options: ADMIN_ROLES.map((r) => ({ value: r, label: statusLabel(r) })),
                            },
                          ],
                        }}
                      />
                      {u.adminRole && (
                        <AdminActionButton
                          action={setAdminRoleAction}
                          payload={{ userId: p.userId, role: "none" }}
                          label="Revoke admin access"
                          variant="ghost"
                          success="Admin access revoked"
                          confirm={{ title: "Revoke admin access?", description: `${p.displayName} will lose access to the admin panel immediately.`, confirmLabel: "Revoke", destructive: true }}
                        />
                      )}
                    </>
                  )
                )}
              </CardContent>
            </Card>
          )}

          {hasAdminPermission(viewer.adminRole, "audit.read") && (
            <Link href={`/admin/audit?target=${p.userId}`} className="block text-[13px] font-medium text-brand-ink hover:underline">
              View audit history for this member
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
