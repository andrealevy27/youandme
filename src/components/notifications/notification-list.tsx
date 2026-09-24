"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  Briefcase,
  Eye,
  Heart,
  MessageCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, formatRelative } from "@/lib/utils";
import { markNotificationsReadAction } from "./actions";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
  actor: { userId: string; name: string; handle: string; avatarUrl: string | null } | null;
};

const ICONS: Record<string, LucideIcon> = {
  new_match: Heart,
  new_message: MessageCircle,
  booking: CalendarCheck,
  booking_reminder: CalendarClock,
  consultant_recommendation: Briefcase,
  connection_request: UserPlus,
  startup_invite: Rocket,
  review_request: Star,
  profile_view: Eye,
  ai_recommendation: Sparkles,
  system: ShieldCheck,
};

function groupOf(date: Date, now: Date): "Today" | "This week" | "Earlier" {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return "Today";
  if (date.getTime() >= startOfToday - 6 * 86_400_000) return "This week";
  return "Earlier";
}

export function NotificationList({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [now] = React.useState(() => new Date());
  const [pending, startTransition] = React.useTransition();
  const unread = items.filter((n) => !n.read).length;

  const groups = (["Today", "This week", "Earlier"] as const)
    .map((label) => ({ label, items: items.filter((n) => groupOf(new Date(n.createdAt), now) === label) }))
    .filter((g) => g.items.length);

  function markAll() {
    const before = items;
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    startTransition(async () => {
      const res = await markNotificationsReadAction();
      if (!res.ok) {
        setItems(before);
        toast.error(res.error);
      }
    });
  }

  async function open(n: NotificationItem) {
    if (!n.read) {
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      void markNotificationsReadAction(n.id);
    }
    if (n.href) router.push(n.href);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {unread ? `${unread} unread` : "All read"}
        </p>
        <Button variant="ghost" size="sm" onClick={markAll} disabled={!unread} loading={pending}>
          Mark all as read
        </Button>
      </div>
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.label} aria-labelledby={`notif-${g.label}`}>
            <h2 id={`notif-${g.label}`} className="mb-2 px-1 text-xs font-medium tracking-wide text-subtle uppercase">
              {g.label}
            </h2>
            <ul className="overflow-hidden rounded-[16px] border border-border bg-card shadow-soft">
              {g.items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => void open(n)}
                      className={cn(
                        "flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface sm:px-5",
                        !n.read && "bg-brand-soft/40",
                        !n.href && "cursor-default",
                      )}
                    >
                      <span className="relative mt-0.5 shrink-0">
                        {n.actor ? (
                          <>
                            <Avatar name={n.actor.name} src={n.actor.avatarUrl} size="md" />
                            <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-card ring-2 ring-card">
                              <Icon className="size-3 text-brand-ink" aria-hidden />
                            </span>
                          </>
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-full bg-surface text-foreground">
                            <Icon className="size-[18px]" aria-hidden />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[15px] leading-snug", n.read ? "font-normal" : "font-semibold")}>{n.title}</span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{n.body}</span>}
                        <time dateTime={n.createdAt} className="mt-1 block text-xs text-subtle" suppressHydrationWarning>
                          {formatRelative(n.createdAt, now)}
                        </time>
                      </span>
                      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
