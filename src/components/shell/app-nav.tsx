"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Settings, Shield, User, UserCog } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { MOBILE_NAV, SIDEBAR_NAV, type NavItem } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";

export type ShellUser = { name: string; handle: string; avatarUrl: string | null; isAdmin: boolean; isConsultant: boolean };
export type ShellCounts = { messages: number; notifications: number };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-brand-foreground tabular-nums", className)}>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}

function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };
}

function AccountMenu({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/people/${user.handle}`}>
            <User /> View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/edit">
            <UserCog /> Edit profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/consultant">
            <UserCog /> {user.isConsultant ? "Consultant workspace" : "Offer consulting"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        {user.isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield /> Admin
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function badgeCount(item: NavItem, counts: ShellCounts) {
  return item.badge ? counts[item.badge] : 0;
}

export function Sidebar({ user, counts }: { user: ShellUser; counts: ShellCounts }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-background px-3 py-5 lg:flex" aria-label="Primary">
      <div className="px-3">
        <Logo href="/home" />
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-0.5">
        {SIDEBAR_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors",
                active ? "bg-card text-foreground shadow-soft ring-1 ring-border" : "text-muted hover:bg-surface hover:text-foreground",
              )}
            >
              <Icon className={cn("size-[18px]", active && item.href === "/ai" && "text-brand")} aria-hidden />
              <span className="flex-1">{item.label}</span>
              <CountBadge n={badgeCount(item, counts)} />
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-1 border-t border-border pt-4">
        <AccountMenu user={user}>
          <button className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-1.5 text-left hover:bg-surface">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-subtle">@{user.handle}</span>
            </span>
          </button>
        </AccountMenu>
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function MobileTopBar({ user, counts }: { user: ShellUser; counts: ShellCounts }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
      <Logo href="/home" />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Link href="/notifications" className="relative rounded-full p-2 text-foreground hover:bg-surface" aria-label="Notifications">
          <Bell className="size-5" />
          {counts.notifications > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand" aria-hidden />}
        </Link>
        <AccountMenu user={user}>
          <button aria-label="Account menu" className="rounded-full p-1">
            <Avatar name={user.name} src={user.avatarUrl} size="xs" />
          </button>
        </AccountMenu>
      </div>
    </header>
  );
}

export function MobileBottomNav({ user, counts }: { user: ShellUser; counts: ShellCounts }) {
  const pathname = usePathname();
  const profileActive = pathname.startsWith("/profile") || pathname === `/people/${user.handle}`;
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const isAI = item.href === "/ai";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-foreground" : "text-subtle")}
            >
              {isAI ? (
                <span className={cn("flex size-9 items-center justify-center rounded-full", active ? "bg-brand-gradient text-white" : "bg-ink text-ink-foreground")}>
                  <Icon className="size-[18px]" aria-hidden />
                </span>
              ) : (
                <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              )}
              {!isAI && <span>{item.label}</span>}
              {isAI && <span className="sr-only">You&amp;Me AI</span>}
              {badgeCount(item, counts) > 0 && <CountBadge n={badgeCount(item, counts)} className="absolute top-1.5 left-1/2 ml-1" />}
            </Link>
          );
        })}
        <Link
          href="/profile"
          aria-current={profileActive ? "page" : undefined}
          className={cn("flex flex-col items-center justify-center gap-1 text-[11px] font-medium", profileActive ? "text-foreground" : "text-subtle")}
        >
          <Avatar name={user.name} src={user.avatarUrl} size="xs" className={cn(profileActive && "ring-2 ring-foreground ring-offset-1 ring-offset-background")} />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
