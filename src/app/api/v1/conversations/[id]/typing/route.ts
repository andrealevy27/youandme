import { apiRoute } from "@/server/messaging/http";
import { setTyping } from "@/server/messaging";

/** POST → `{ ok: true }`. Clients call this at most every 3s while composing. */
export const POST = apiRoute<{ id: string }>(async ({ viewer, params }) => {
  await setTyping(params.id, viewer.userId);
  return { ok: true };
});
