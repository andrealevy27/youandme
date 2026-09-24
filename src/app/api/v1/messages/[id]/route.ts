import { apiRoute } from "@/server/messaging/http";
import { deleteMessage } from "@/server/messaging";

/** DELETE → `{ ok: true }`. Only the sender can delete; the message becomes a tombstone. */
export const DELETE = apiRoute<{ id: string }>(async ({ viewer, params }) => {
  await deleteMessage(params.id, viewer.userId);
  return { ok: true };
});
