import { z } from "zod";
import { askConcierge, getConciergeThread, listConciergeThreads } from "@/server/ai/concierge";
import { jsonRoute, readJsonBody } from "@/server/ai/http";

// The model ↔ tools loop can take a while; the concierge falls back to basic mode after 75s.
export const maxDuration = 90;

/** POST { threadId?: string|null, message: string } → ConciergeReply */
export const POST = jsonRoute(async ({ req, viewer }) => {
  const body = z.object({ threadId: z.string().nullish(), message: z.string() }).parse(await readJsonBody(req));
  return askConcierge(viewer.userId, body.threadId ?? null, body.message);
});

/** GET → { threads } · GET ?threadId= → { thread, messages } */
export const GET = jsonRoute(async ({ req, viewer }) => {
  const threadId = new URL(req.url).searchParams.get("threadId");
  if (threadId) return getConciergeThread(viewer.userId, z.string().uuid().parse(threadId));
  return { threads: await listConciergeThreads(viewer.userId) };
});
