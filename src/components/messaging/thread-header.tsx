"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Bell, BellOff, ChevronLeft, Flag, MoreHorizontal, Rocket, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BlockConfirmDialog } from "@/components/moderation/block-button";
import { ReportDialog } from "@/components/moderation/report-dialog";
import { AvatarStack } from "./avatar-stack";
import { INBOX_REFRESH_EVENT } from "./inbox-list";
import type { ThreadDTO } from "./types";

export function ThreadHeader({ thread, typingLabel }: { thread: ThreadDTO; typingLabel: string | null }) {
  const router = useRouter();
  const [muted, setMuted] = React.useState(thread.muted);
  const [membersOpen, setMembersOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const isGroup = thread.type === "startup_group" || thread.members.length > 1;
  const other = !isGroup ? thread.members[0] : undefined;

  const avatars =
    thread.type === "startup_group" && thread.startup
      ? [{ name: thread.startup.name, avatarUrl: thread.startup.logoUrl }, ...thread.members.slice(0, 1)]
      : thread.members.slice(0, 2);
  const titleHref = thread.type === "startup_group" && thread.startup ? `/startups/${thread.startup.slug}` : other ? `/people/${other.handle}` : null;

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    const res = await fetch(`/api/v1/conversations/${thread.id}/mute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ muted: next }),
    }).catch(() => null);
    if (!res?.ok) {
      setMuted(!next);
      toast.error("Couldn't update notifications for this conversation.");
      return;
    }
    toast.success(next ? "Muted. You won't get notified about new messages." : "Unmuted.");
    window.dispatchEvent(new Event(INBOX_REFRESH_EVENT));
  }

  const titleNode = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-[15px] font-semibold">{thread.title}</span>
      {muted && <BellOff className="size-3.5 shrink-0 text-subtle" aria-label="Muted" />}
    </span>
  );

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-2 backdrop-blur-md sm:px-4 lg:bg-card">
      <Link href="/messages" className="rounded-full p-2 text-foreground hover:bg-surface lg:hidden" aria-label="Back to messages">
        <ChevronLeft className="size-5" />
      </Link>
      {titleHref ? (
        <Link href={titleHref} className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] py-1 pr-2 hover:opacity-90">
          <AvatarStack people={avatars} />
          <span className="min-w-0">
            {titleNode}
            <Subtitle thread={thread} typingLabel={typingLabel} />
          </span>
        </Link>
      ) : (
        <button type="button" onClick={() => setMembersOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 py-1 pr-2 text-left">
          <AvatarStack people={avatars} />
          <span className="min-w-0">
            {titleNode}
            <Subtitle thread={thread} typingLabel={typingLabel} />
          </span>
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full p-2 text-muted hover:bg-surface hover:text-foreground" aria-label="Conversation options">
          <MoreHorizontal className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {isGroup && (
            <DropdownMenuItem onSelect={() => setMembersOpen(true)}>
              <Users /> Members ({thread.members.length + 1})
            </DropdownMenuItem>
          )}
          {thread.startup && (
            <DropdownMenuItem asChild>
              <Link href={`/startups/${thread.startup.slug}`}>
                <Rocket /> View {thread.startup.name}
              </Link>
            </DropdownMenuItem>
          )}
          {other && (
            <DropdownMenuItem asChild>
              <Link href={`/people/${other.handle}`}>
                <User /> View profile
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={toggleMute}>
            {muted ? <Bell /> : <BellOff />} {muted ? "Unmute" : "Mute notifications"}
          </DropdownMenuItem>
          {other && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setReportOpen(true)}>
                <Flag /> Report {other.name.split(" ")[0]}
              </DropdownMenuItem>
              {!thread.blocked && (
                <DropdownMenuItem destructive onSelect={() => setBlockOpen(true)}>
                  <Ban /> Block {other.name.split(" ")[0]}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent title="Members" description={thread.startup ? `Everyone on the ${thread.startup.name} team.` : undefined}>
          <ul className="-mx-2 space-y-0.5">
            {thread.members.map((m) => (
              <li key={m.userId}>
                <Link href={`/people/${m.handle}`} className="flex items-center gap-3 rounded-[12px] px-2 py-2 hover:bg-surface" onClick={() => setMembersOpen(false)}>
                  <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    {m.headline && <span className="block truncate text-xs text-muted">{m.headline}</span>}
                  </span>
                </Link>
              </li>
            ))}
            <li className="px-2 py-2 text-xs text-subtle">and you</li>
          </ul>
        </DialogContent>
      </Dialog>
      {other && (
        <>
          <ReportDialog targetType="user" targetId={other.userId} open={reportOpen} onOpenChange={setReportOpen} />
          <BlockConfirmDialog
            userId={other.userId}
            name={other.name}
            open={blockOpen}
            onOpenChange={setBlockOpen}
            onBlocked={() => {
              window.dispatchEvent(new Event(INBOX_REFRESH_EVENT));
              router.push("/messages");
            }}
          />
        </>
      )}
    </header>
  );
}

function Subtitle({ thread, typingLabel }: { thread: ThreadDTO; typingLabel: string | null }) {
  if (typingLabel) return <span className="block truncate text-xs font-medium text-brand-ink">{typingLabel}…</span>;
  if (!thread.subtitle) return null;
  return <span className="block truncate text-xs text-muted">{thread.subtitle}</span>;
}
