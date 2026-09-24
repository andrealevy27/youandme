import { apiRoute } from "@/server/messaging/http";
import { markConversationRead } from "@/server/messaging";

/** POST → `{ ok: true }`. Marks everything up to now as read for the viewer. */
export const POST = apiRoute<{ id: string }>(async ({ viewer, params }) => {
  await markConversationRead(params.id, viewer.userId);
  return { ok: true };
});
