import { z } from "zod";
import { apiRoute, readJson } from "@/server/messaging/http";
import { markNotificationsRead } from "@/server/notifications";

/** POST `{ id? }` → marks one notification (or all when omitted) as read. */
export const POST = apiRoute(async ({ req, viewer }) => {
  const hasBody = (req.headers.get("content-length") ?? "0") !== "0" || req.headers.get("transfer-encoding") !== null;
  const { id } = z.object({ id: z.string().min(1).max(100).optional() }).parse(hasBody ? await readJson(req) : {});
  await markNotificationsRead(viewer.userId, id);
  return { ok: true };
});
