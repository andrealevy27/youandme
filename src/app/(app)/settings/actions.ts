"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { updateProfile } from "@/server/people/profile";
import { deleteAccount } from "@/server/privacy/account";
import { requestUniversityVerification } from "@/server/verification";
import { unblockUser } from "@/server/moderation";
import { VISIBILITY } from "@/lib/domain";

export async function setVisibilityAction(visibility: (typeof VISIBILITY)[number]) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updateProfile(viewer.userId, { visibility: z.enum(VISIBILITY).parse(visibility) });
    revalidatePath("/settings");
    return { ok: true };
  });
}

export async function requestUniversityVerificationAction(email: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    return requestUniversityVerification(viewer.userId, email);
  });
}

export async function unblockAction(userId: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await unblockUser(viewer.userId, z.string().min(1).parse(userId));
    revalidatePath("/settings");
    return { ok: true };
  });
}

export async function deleteAccountAction(confirmation: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const h = await headers();
    await deleteAccount(viewer.userId, { confirmation, ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null });
    return { ok: true };
  });
}
