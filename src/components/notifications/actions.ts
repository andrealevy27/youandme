"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction, type ActionResult } from "@/server/errors";
import { markNotificationsRead, updateNotificationPreference, type preferenceInput } from "@/server/notifications";

export async function updateNotificationPreferenceAction(
  input: z.input<typeof preferenceInput>,
): Promise<ActionResult<{ type: string; inApp: boolean; email: boolean }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return updateNotificationPreference(viewer.userId, input);
  });
}

/** Mark one notification (or all, when `id` is omitted) as read. */
export async function markNotificationsReadAction(id?: string): Promise<ActionResult> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await markNotificationsRead(viewer.userId, id ? z.string().min(1).max(100).parse(id) : undefined);
    revalidatePath("/", "layout");
  });
}
