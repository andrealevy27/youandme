import { z } from "zod";
import { apiRoute, readJson } from "@/server/messaging/http";
import { getMessageDTO, listMessagesDTO, sendMessage } from "@/server/messaging";

const query = z.object({
  after: z.coerce.date().optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET ?after=<iso> (polling, oldest→newest) or ?before=<iso> (history) → `{ messages: MessageDTO[], hasMore }`.
 * 401 signed out · 403 not a member.
 */
export const GET = apiRoute<{ id: string }>(async ({ req, viewer, params }) => {
  const sp = new URL(req.url).searchParams;
  const q = query.parse({ after: sp.get("after") ?? undefined, before: sp.get("before") ?? undefined, limit: sp.get("limit") ?? undefined });
  return listMessagesDTO(params.id, viewer.userId, q);
});

const body = z.object({
  body: z.string().max(5000).optional(),
  attachments: z.array(z.object({ url: z.string(), name: z.string(), size: z.number(), mime: z.string() })).max(5).optional(),
});

/** POST `{ body?, attachments? }` → `{ message: MessageDTO }`. Attachments must come from POST /api/v1/uploads. */
export const POST = apiRoute<{ id: string }>(async ({ req, viewer, params }) => {
  const input = body.parse(await readJson(req));
  const msg = await sendMessage(viewer.userId, { conversationId: params.id, body: input.body ?? "", attachments: input.attachments });
  return { message: await getMessageDTO(msg.id) };
});
