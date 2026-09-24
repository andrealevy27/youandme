import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { AdminMobileTabs, AdminSidebarNav, type AdminNavLink } from "@/components/admin/admin-nav";
import { statusLabel } from "@/components/admin/status-badge";
import { getViewer } from "@/server/auth/session";
import { visibleAdminNav } from "@/server/admin/nav";
import { adminQueueCounts } from "@/server/admin/queues";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · You&Me" },
  robots: { index: false, follow: false },
};

/** Admin chrome. Access is re-checked per page with the page's specific permission. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.adminRole) redirect("/home");

  const counts = await adminQueueCounts(viewer.adminRole);
  const items: AdminNavLink[] = visibleAdminNav(viewer.adminRole).map((i) => ({ href: i.href, label: i.label, badge: counts[i.href] }));

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-border bg-background px-3 py-5 lg:flex" aria-label="Admin">
        <Link href={items[0]?.href ?? "/admin"} className="flex items-center gap-2 px-3 font-semibold tracking-tight">
          <LogoMark className="size-6" />
          <span className="text-[15px]">You&amp;Me</span>
          <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-ink-foreground">Admin</span>
        </Link>
        <div className="mt-7 flex-1 overflow-y-auto">
          <AdminSidebarNav items={items} />
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2.5 px-1.5">
            <Avatar name={viewer.displayName} src={viewer.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{viewer.displayName}</p>
              <p className="truncate text-xs text-subtle">{statusLabel(viewer.adminRole)}</p>
            </div>
            <ThemeToggle />
          </div>
          <Link href="/home" className="mt-3 flex h-9 items-center gap-2 rounded-[10px] px-3 text-[13px] font-medium text-muted hover:bg-surface hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Back to You&amp;Me
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 pt-3 backdrop-blur-md lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          {/* Text wordmark: LogoMark's gradient id lives in the (hidden) desktop sidebar. */}
          <Link href={items[0]?.href ?? "/admin"} className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="text-[15px]">You&amp;Me</span>
            <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-ink-foreground">Admin</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/home" className="rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface hover:text-foreground">
              Exit admin
            </Link>
          </div>
        </div>
        <AdminMobileTabs items={items} />
      </header>

      <main id="main" className="lg:pl-[232px]">
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-5 pb-16 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">{children}</div>
      </main>
    </div>
  );
}
