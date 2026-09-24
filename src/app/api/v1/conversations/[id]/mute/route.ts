import { z } from "zod";
import { apiRoute, readJson } from "@/server/messaging/http";
import { setMuted } from "@/server/messaging";

/** POST `{ muted: boolean }` → `{ muted }`. */
export const POST = apiRoute<{ id: string }>(async ({ req, viewer, params }) => {
  const { muted } = z.object({ muted: z.boolean() }).parse(await readJson(req));
  await setMuted(params.id, viewer.userId, muted);
  return { muted };
});
