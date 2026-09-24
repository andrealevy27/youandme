import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationList } from "@/components/notifications/notification-list";
import { requireViewerPage } from "@/server/auth/session";
import { listNotificationsWithActors } from "@/server/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewerPage();
  const items = await listNotificationsWithActors(viewer.userId, { limit: 100 });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" description="Matches, messages, bookings and invites — in one place." />
      {items.length === 0 ? (
        <EmptyState
          icon={<BellRing />}
          title="You're all caught up."
          description="When something needs your attention — a new match, a message or a booking — it'll show up here."
        />
      ) : (
        <NotificationList initial={items} />
      )}
    </div>
  );
}
