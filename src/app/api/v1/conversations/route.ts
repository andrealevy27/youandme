import { z } from "zod";
import { apiRoute } from "@/server/messaging/http";
import { listInboxDTO } from "@/server/messaging";

const query = z.object({
  filter: z.enum(["all", "matches", "consultants", "startups", "direct"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET ?filter=all|matches|consultants|startups|direct&limit= → `{ conversations: InboxItemDTO[] }` */
export const GET = apiRoute(async ({ req, viewer }) => {
  const url = new URL(req.url);
  const q = query.parse({ filter: url.searchParams.get("filter") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  return { conversations: await listInboxDTO(viewer.userId, q) };
});
