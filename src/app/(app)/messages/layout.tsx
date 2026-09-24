import type { Metadata } from "next";
import { InboxList } from "@/components/messaging/inbox-list";
import { MessagesShell } from "@/components/messaging/messages-shell";
import { requireViewerPage } from "@/server/auth/session";
import { listInboxDTO } from "@/server/messaging";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewerPage();
  const inbox = await listInboxDTO(viewer.userId, { limit: 100 });
  return <MessagesShell list={<InboxList initial={inbox} />}>{children}</MessagesShell>;
}
