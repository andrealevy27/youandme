"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, MoreHorizontal, Shield, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { inviteToStartupAction, removeMemberAction, revokeInviteAction, updateMemberAction } from "@/app/(app)/startups/actions";
import { STARTUP_MEMBER_ROLES, STARTUP_MEMBER_ROLE_LABELS, type StartupMemberRole } from "@/lib/domain";

type Member = { userId: string; name: string; handle: string; avatarUrl: string | null; role: StartupMemberRole; title: string | null; isAdmin: boolean };

export function TeamManager(props: {
  startupId: string;
  slug: string;
  viewerId: string;
  canInvite: boolean;
  canManage: boolean;
  canRemove: boolean;
  members: Member[];
  invites: { id: string; email: string | null; role: StartupMemberRole; expiresAt: string }[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<StartupMemberRole>("cofounder");
  const [makeAdmin, setMakeAdmin] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function run<T>(p: Promise<{ ok: boolean; error?: string } & T>, success?: string) {
    const res = await p;
    if (!res.ok) return toast.error(res.error ?? "Something went wrong.");
    if (success) toast.success(success);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-0 sm:p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <h2 className="text-[15px] font-semibold">{props.members.length} members</h2>
            {props.canInvite && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus /> Invite
              </Button>
            )}
          </div>
          <ul className="mt-3 divide-y divide-border">
            {props.members.map((m) => {
              const self = m.userId === props.viewerId;
              return (
                <li key={m.userId} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <Avatar name={m.name} src={m.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/people/${m.handle}`} className="text-sm font-medium hover:underline">
                      {m.name}
                      {self && <span className="text-subtle"> (you)</span>}
                    </Link>
                    <p className="truncate text-xs text-muted">{m.title ?? STARTUP_MEMBER_ROLE_LABELS[m.role]}</p>
                  </div>
                  <Badge variant={m.role === "founder" ? "brand" : "neutral"}>{STARTUP_MEMBER_ROLE_LABELS[m.role]}</Badge>
                  {(m.isAdmin || m.role === "founder") && (
                    <span title="Admin">
                      <Shield className="size-4 text-subtle" aria-label="Admin" />
                    </span>
                  )}
                  {(props.canManage || props.canRemove || self) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={`Manage ${m.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {props.canManage &&
                          STARTUP_MEMBER_ROLES.filter((r) => r !== m.role).map((r) => (
                            <DropdownMenuItem key={r} onSelect={() => run(updateMemberAction(props.startupId, m.userId, { role: r }, props.slug))}>
                              Make {STARTUP_MEMBER_ROLE_LABELS[r].toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                        {props.canManage && (
                          <DropdownMenuItem onSelect={() => run(updateMemberAction(props.startupId, m.userId, { isAdmin: !m.isAdmin }, props.slug))}>
                            {m.isAdmin ? "Remove admin rights" : "Make admin"}
                          </DropdownMenuItem>
                        )}
                        {(props.canRemove || self) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onSelect={() => run(removeMemberAction(props.startupId, m.userId, props.slug), self ? "You left the team." : `${m.name} removed.`)}>
                              {self ? "Leave team" : "Remove from team"}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {props.invites.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="mb-3 text-[15px] font-semibold">Pending invites</h2>
            <ul className="space-y-2">
              {props.invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 text-sm">
                  <Mail className="size-4 text-subtle" aria-hidden />
                  <span className="flex-1 truncate">{i.email ?? "Member invite"}</span>
                  <Badge>{STARTUP_MEMBER_ROLE_LABELS[i.role]}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => run(revokeInviteAction(i.id, props.slug), "Invite revoked.")}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent title="Invite to the team" description="Invite by email. If they're already on You&Me, they'll get a notification too.">
          <div className="space-y-4">
            <Field label="Email" htmlFor="invite-email">
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Role" htmlFor="invite-role">
              <NativeSelect id="invite-role" value={role} onChange={(e) => setRole(e.target.value as StartupMemberRole)}>
                {STARTUP_MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {STARTUP_MEMBER_ROLE_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {props.canManage && (
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>
                  <span className="font-medium">Admin</span>
                  <span className="block text-muted">Can edit the startup, invite people and manage bookings.</span>
                </span>
                <Switch checked={makeAdmin} onCheckedChange={setMakeAdmin} aria-label="Make admin" />
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={busy}
                disabled={!email.includes("@")}
                onClick={async () => {
                  setBusy(true);
                  const res = await inviteToStartupAction(props.startupId, { email, role, makeAdmin });
                  setBusy(false);
                  if (!res.ok) return toast.error(res.error);
                  toast.success(`Invite sent to ${email}.`);
                  setInviteOpen(false);
                  setEmail("");
                  router.refresh();
                }}
              >
                Send invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
