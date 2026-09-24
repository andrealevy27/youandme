"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { decideVerification } from "@/server/admin/verification";

export async function decideVerificationAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("verification.review");
    const data = z
      .object({ id: z.string().trim().min(1).max(128), decision: z.enum(["verified", "rejected"]), reason: z.string().trim().max(500).optional() })
      .parse(raw);
    await decideVerification(viewer, data);
    revalidatePath("/admin", "layout");
  });
}
