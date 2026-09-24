import { unreadNotificationCount } from "@/server/notifications";
import { totalUnreadConversations } from "@/server/messaging";
import type { Viewer } from "@/server/auth/session";
import { MobileBottomNav, MobileTopBar, Sidebar, type ShellUser } from "./app-nav";

/** Authenticated app chrome: left sidebar on desktop, top bar + bottom tabs on mobile. */
export async function AppShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const [messages, notifications] = await Promise.all([
    totalUnreadConversations(viewer.userId),
    unreadNotificationCount(viewer.userId),
  ]);
  const user: ShellUser = {
    name: viewer.displayName,
    handle: viewer.handle,
    avatarUrl: viewer.avatarUrl,
    isAdmin: !!viewer.adminRole,
    isConsultant: viewer.roles.includes("consultant"),
  };
  const counts = { messages, notifications };
  return (
    <div className="min-h-dvh">
      <Sidebar user={user} counts={counts} />
      <MobileTopBar user={user} counts={counts} />
      <main id="main" className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-[248px]">
        <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 pb-10 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">{children}</div>
      </main>
      <MobileBottomNav user={user} counts={counts} />
    </div>
  );
}
