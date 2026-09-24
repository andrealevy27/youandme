"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { reviewConsultant, setConsultantFeatured } from "@/server/admin/consultants";

const id = z.string().trim().min(1).max(128);

function revalidate() {
  revalidatePath("/admin/consultants");
  revalidatePath("/admin", "layout");
}

const reviewInput = z
  .object({
    userId: id,
    decision: z.enum(["approved", "rejected", "suspended"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.decision === "approved" || (v.reason && v.reason.length >= 3), {
    message: "Add a short reason — it's shared with the consultant.",
    path: ["reason"],
  });

export async function reviewConsultantAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("consultants.review");
    const data = reviewInput.parse(raw);
    await reviewConsultant(viewer, data);
    revalidate();
  });
}

export async function setConsultantFeaturedAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("featured.manage");
    const data = z.object({ userId: id, featured: z.boolean() }).parse(raw);
    await setConsultantFeatured(viewer, data);
    revalidate();
  });
}
