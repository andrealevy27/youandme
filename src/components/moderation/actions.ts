"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction, type ActionResult } from "@/server/errors";
import { blockUser, reportContent, unblockUser, type ReportInput } from "@/server/moderation";

const userId = z.string().min(1).max(100);

/** Used by `<ReportDialog>`. Duplicate open reports from the same person are merged. */
export async function reportContentAction(input: ReportInput): Promise<ActionResult<{ id: string; duplicate: boolean }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    return reportContent(viewer.userId, input);
  });
}

/** Used by `<BlockButton>`. */
export async function blockUserAction(targetUserId: string): Promise<ActionResult<{ blocked: true }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await blockUser(viewer.userId, userId.parse(targetUserId));
    revalidatePath("/", "layout");
    return { blocked: true as const };
  });
}

export async function unblockUserAction(targetUserId: string): Promise<ActionResult<{ blocked: false }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await unblockUser(viewer.userId, userId.parse(targetUserId));
    revalidatePath("/", "layout");
    return { blocked: false as const };
  });
}
