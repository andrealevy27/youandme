import { apiRoute } from "@/server/messaging/http";
import { getThread } from "@/server/messaging";

/** GET → `{ thread: ThreadDTO }` (403 when not a member). */
export const GET = apiRoute<{ id: string }>(async ({ viewer, params }) => ({ thread: await getThread(params.id, viewer.userId) }));
