import { z } from "zod";
import { apiRoute } from "@/server/messaging/http";
import { listNotificationsWithActors, unreadNotificationCount } from "@/server/notifications";

const query = z.object({
  cursor: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unread: z.enum(["1", "true"]).optional(),
});

/** GET ?cursor=<iso>&limit=&unread=1 → `{ notifications, unread, nextCursor }` */
export const GET = apiRoute(async ({ req, viewer }) => {
  const sp = new URL(req.url).searchParams;
  const q = query.parse({ cursor: sp.get("cursor") ?? undefined, limit: sp.get("limit") ?? undefined, unread: sp.get("unread") ?? undefined });
  const [items, unread] = await Promise.all([
    listNotificationsWithActors(viewer.userId, { cursor: q.cursor, limit: q.limit, unreadOnly: !!q.unread }),
    unreadNotificationCount(viewer.userId),
  ]);
  return { notifications: items, unread, nextCursor: items.length === q.limit ? items[items.length - 1]!.createdAt : null };
});
