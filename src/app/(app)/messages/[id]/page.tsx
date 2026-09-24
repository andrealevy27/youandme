import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThreadView } from "@/components/messaging/thread-view";
import { requireViewerPage } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getConversationState, getThread, listMessagesDTO } from "@/server/messaging";

export const metadata: Metadata = { title: "Messages" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewerPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await Promise.all([
    getThread(id, viewer.userId),
    listMessagesDTO(id, viewer.userId, { limit: 50 }),
    getConversationState(id, viewer.userId),
  ]).catch((err: unknown) => {
    // Non-members get the same response as a missing thread — no existence leak.
    if (err instanceof AppError && (err.code === "FORBIDDEN" || err.code === "NOT_FOUND")) notFound();
    throw err;
  });
  const [thread, page, state] = data;
  return <ThreadView key={id} thread={thread} initialMessages={page.messages} initialHasMore={page.hasMore} initialState={state} />;
}
