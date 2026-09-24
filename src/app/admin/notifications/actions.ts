"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { broadcastNotification } from "@/server/admin/broadcast";
import { USER_ROLES } from "@/lib/domain";

const input = z.object({
  title: z.string().trim().min(3, "Add a title.").max(120),
  body: z.string().trim().max(1000).optional().transform((v) => v || undefined),
  href: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")), "Links must be an in-app path like /matches.")
    .optional()
    .transform((v) => v || undefined),
  audience: z.enum(["all", ...USER_ROLES]),
  excludeDemo: z.boolean().default(true),
});

export async function broadcastAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("notifications.broadcast");
    const data = input.parse(raw);
    const result = await broadcastNotification(viewer, {
      title: data.title,
      body: data.body,
      href: data.href,
      audience: data.audience === "all" ? "all" : { role: data.audience },
      excludeDemo: data.excludeDemo,
    });
    revalidatePath("/admin/notifications");
    return result;
  });
}
