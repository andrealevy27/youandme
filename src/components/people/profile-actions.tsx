"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock, Heart, MessageCircle, MoreHorizontal, Rocket, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, NativeSelect } from "@/components/ui/input";
import { SaveButton } from "@/components/saved/save-button";
import { ReportDialog } from "@/components/moderation/report-dialog";
import { BlockButton } from "@/components/moderation/block-button";
import { connectAction, profileInterestedAction, removeConnectionAction, respondConnectionAction } from "@/app/(app)/profile/actions";
import { startDirectConversationAction } from "@/app/(app)/messages/actions";
import { inviteToStartupAction } from "@/app/(app)/startups/actions";
import { STARTUP_MEMBER_ROLES, STARTUP_MEMBER_ROLE_LABELS, type StartupMemberRole } from "@/lib/domain";
import type { ConnectionState } from "@/server/connections";

/**
 * Context-aware primary CTA:
 * matched → Message · consultant → Book · cofounder seeker → Interested · otherwise → Connect.
 */
export function ProfileActions(props: {
  targetId: string;
  handle: string;
  name: string;
  isConsultant: boolean;
  lookingForCofounder: boolean;
  myInterest: "interested" | "passed" | null;
  matchConversationId: string | null;
  connection: ConnectionState;
  connectionId: string | null;
  inviteStartups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [interest, setInterest] = React.useState(props.myInterest);
  const [connection, setConnection] = React.useState(props.connection);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const first = props.name.split(" ")[0];

  async function message() {
    setBusy("message");
    const res = await startDirectConversationAction(props.targetId);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    router.push(`/messages/${res.data.conversationId}`);
  }

  async function interested() {
    setBusy("interested");
    const res = await profileInterestedAction(props.targetId);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setInterest("interested");
    if (res.data.matched && res.data.conversationId) {
      toast.success(`It's a match — you and ${first} are both interested.`);
      router.push(`/messages/${res.data.conversationId}`);
    } else toast.success(`We'll let you know if ${first} is interested too.`);
  }

  async function connect() {
    setBusy("connect");
    const res = connection === "incoming" && props.connectionId ? await respondConnectionAction(props.connectionId, true) : await connectAction(props.targetId);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setConnection(res.data.state);
  }

  async function disconnect() {
    setBusy("connect");
    const res = await removeConnectionAction(props.targetId);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setConnection("none");
  }

  let primary: React.ReactNode;
  if (props.matchConversationId) {
    primary = (
      <Button asChild>
        <Link href={`/messages/${props.matchConversationId}`}>
          <MessageCircle /> Message
        </Link>
      </Button>
    );
  } else if (props.isConsultant) {
    primary = (
      <Button asChild>
        <Link href={`/consultants/${props.handle}`}>Book consultation</Link>
      </Button>
    );
  } else if (props.lookingForCofounder) {
    primary =
      interest === "interested" ? (
        <Button variant="soft" disabled>
          <Heart className="fill-current" /> Interested
        </Button>
      ) : (
        <Button onClick={interested} loading={busy === "interested"}>
          <Heart /> Interested
        </Button>
      );
  } else {
    primary = null;
  }

  const connectButton =
    connection === "connected" ? (
      <Button variant="secondary" onClick={disconnect} loading={busy === "connect"} title="Remove connection">
        <Check /> Connected
      </Button>
    ) : connection === "outgoing" ? (
      <Button variant="secondary" onClick={disconnect} loading={busy === "connect"} title="Withdraw request">
        <Clock /> Requested
      </Button>
    ) : (
      <Button variant={primary ? "secondary" : "primary"} onClick={connect} loading={busy === "connect"}>
        <UserPlus /> {connection === "incoming" ? "Accept request" : "Connect"}
      </Button>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary}
      {connectButton}
      {!props.matchConversationId && (
        <Button variant="secondary" onClick={message} loading={busy === "message"} aria-label={`Message ${props.name}`}>
          <MessageCircle />
          <span className="sm:hidden lg:inline">Message</span>
        </Button>
      )}
      <SaveButton targetType={props.isConsultant ? "consultant" : "user"} targetId={props.targetId} initialSaved={false} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {props.inviteStartups.length > 0 && (
            <DropdownMenuItem onSelect={() => setInviteOpen(true)}>
              <Rocket /> Invite to startup
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setReportOpen(true)}>Report</DropdownMenuItem>
          <div className="px-1 py-0.5">
            <BlockButton userId={props.targetId} name={props.name} variant="ghost" size="sm" className="w-full justify-start" />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog targetType={props.isConsultant ? "consultant" : "user"} targetId={props.targetId} open={reportOpen} onOpenChange={setReportOpen} />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} startups={props.inviteStartups} targetId={props.targetId} name={props.name} />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  startups,
  targetId,
  name,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  startups: { id: string; name: string }[];
  targetId: string;
  name: string;
}) {
  const [startupId, setStartupId] = React.useState(startups[0]?.id ?? "");
  const [role, setRole] = React.useState<StartupMemberRole>("cofounder");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Invite ${name} to your startup`} description="They'll get an invite they can accept or decline.">
        <div className="space-y-4">
          <Field label="Startup" htmlFor="invite-startup">
            <NativeSelect id="invite-startup" value={startupId} onChange={(e) => setStartupId(e.target.value)}>
              {startups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const res = await inviteToStartupAction(startupId, { userId: targetId, role, makeAdmin: false });
                setBusy(false);
                if (!res.ok) return toast.error(res.error);
                toast.success(`Invite sent to ${name}.`);
                onOpenChange(false);
              }}
            >
              Send invite
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
