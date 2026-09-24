"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { hideStartup, restoreStartup, softDeleteStartup } from "@/server/admin/startups";

const id = z.string().trim().min(1).max(128);

export async function hideStartupAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("startups.moderate");
    const data = z.object({ id, reason: z.string().trim().max(1000).optional() }).parse(raw);
    await hideStartup(viewer, data);
    revalidatePath("/admin/startups");
  });
}

export async function restoreStartupAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("startups.moderate");
    const data = z.object({ id }).parse(raw);
    await restoreStartup(viewer, data);
    revalidatePath("/admin/startups");
  });
}

export async function deleteStartupAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("startups.moderate");
    const data = z.object({ id, reason: z.string().trim().min(3, "Add a short reason for the audit log.").max(1000) }).parse(raw);
    await softDeleteStartup(viewer, data);
    revalidatePath("/admin/startups");
  });
}
