"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { setReviewStatus } from "@/server/admin/reviews";

export async function setReviewStatusAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("reviews.moderate");
    const data = z
      .object({ id: z.string().trim().min(1).max(128), status: z.enum(["published", "hidden"]), reason: z.string().trim().max(1000).optional() })
      .parse(raw);
    await setReviewStatus(viewer, data);
    revalidatePath("/admin/reviews");
  });
}
