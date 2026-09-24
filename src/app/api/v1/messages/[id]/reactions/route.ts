import { z } from "zod";
import { apiRoute, readJson } from "@/server/messaging/http";
import { ALLOWED_REACTIONS, toggleReaction } from "@/server/messaging";

/** POST `{ emoji }` (one of ALLOWED_REACTIONS) → `{ reacted, reactions }`. Toggles the viewer's reaction. */
export const POST = apiRoute<{ id: string }>(async ({ req, viewer, params }) => {
  const { emoji } = z.object({ emoji: z.enum(ALLOWED_REACTIONS) }).parse(await readJson(req));
  return toggleReaction(params.id, viewer.userId, emoji);
});
