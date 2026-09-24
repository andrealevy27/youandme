"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarCheck,
  Flag,
  LayoutDashboard,
  Rocket,
  ScrollText,
  Settings2,
  Sprout,
  Star,
  Tags,
  Users,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminNavLink = { href: string; label: string; badge?: number };

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/users": Users,
  "/admin/consultants": Briefcase,
  "/admin/startups": Rocket,
  "/admin/reports": Flag,
  "/admin/bookings": CalendarCheck,
  "/admin/categories": Tags,
  "/admin/reviews": Star,
  "/admin/verification": BadgeCheck,
  "/admin/growth": Sprout,
  "/admin/settings": Settings2,
  "/admin/notifications": Bell,
  "/admin/audit": ScrollText,
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Count({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-brand-foreground tabular-nums">
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Desktop: fixed left rail. */
export function AdminSidebarNav({ items }: { items: AdminNavLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Admin sections">
      {items.map((item) => {
        const Icon = ICONS[item.href] ?? BookOpen;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-[10px] px-3 text-[13.5px] font-medium transition-colors",
              active ? "bg-card text-foreground shadow-soft ring-1 ring-border" : "text-muted hover:bg-surface hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            <Count n={item.badge} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: horizontally scrolling tabs under the top bar. */
export function AdminMobileTabs({ items }: { items: AdminNavLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 pb-2" aria-label="Admin sections">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
              active ? "bg-ink text-ink-foreground" : "bg-surface text-muted hover:text-foreground",
            )}
          >
            {item.label}
            {!!item.badge && <span className={cn("tabular-nums", active ? "opacity-80" : "text-brand-ink")}>{item.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
