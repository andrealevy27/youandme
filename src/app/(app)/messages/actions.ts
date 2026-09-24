"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction, type ActionResult } from "@/server/errors";
import { setMuted, startConversationWithUser } from "@/server/messaging";
import { ensureStartupGroupConversation } from "@/server/messaging/groups";

const id = z.string().min(1).max(100);

/**
 * Profile "Message" button. Respects blocks and profile visibility; returns the single
 * direct thread for the pair (created on first use). Navigate to `/messages/${conversationId}`.
 */
export async function startDirectConversationAction(otherUserId: string): Promise<ActionResult<{ conversationId: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const convo = await startConversationWithUser(viewer.userId, id.parse(otherUserId));
    revalidatePath("/messages", "layout");
    return { conversationId: convo.id };
  });
}

/** Startup "Team chat" button: opens (creating if needed) the startup's group conversation. Caller must be an active member. */
export async function openStartupGroupChatAction(startupId: string): Promise<ActionResult<{ conversationId: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const convo = await ensureStartupGroupConversation(id.parse(startupId), viewer.userId);
    revalidatePath("/messages", "layout");
    return { conversationId: convo.id };
  });
}

export async function setConversationMutedAction(conversationId: string, muted: boolean): Promise<ActionResult<{ muted: boolean }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await setMuted(id.parse(conversationId), viewer.userId, z.boolean().parse(muted));
    revalidatePath("/messages", "layout");
    return { muted };
  });
}
