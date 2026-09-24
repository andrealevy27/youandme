import type { Metadata } from "next";
import { ConciergeChat } from "@/components/ai/concierge-chat";
import { requireViewerPage } from "@/server/auth/session";
import { getConciergeThread, listConciergeThreads, type ConciergeMessage } from "@/server/ai/concierge";
import { AppError } from "@/server/errors";
import { features } from "@/server/env";

export const metadata: Metadata = { title: "You&Me AI" };

export default async function AIPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewerPage();
  const sp = await searchParams;
  const threadParam = typeof sp.thread === "string" ? sp.thread : null;
  const prompt = typeof sp.q === "string" ? sp.q.slice(0, 500) : undefined;

  const threads = await listConciergeThreads(viewer.userId);
  let threadId: string | null = null;
  let messages: ConciergeMessage[] = [];
  if (threadParam) {
    try {
      const t = await getConciergeThread(viewer.userId, threadParam);
      threadId = t.thread.id;
      messages = t.messages;
    } catch (err) {
      // Unknown or someone else's thread: start fresh rather than erroring.
      if (!(err instanceof AppError)) throw err;
    }
  }

  return (
    <ConciergeChat
      key={threadId ?? "new"}
      initialThreadId={threadId}
      initialMessages={messages}
      threads={threads}
      basicMode={!features.ai}
      initialPrompt={prompt}
      viewerName={viewer.displayName}
    />
  );
}
