"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { ensureDirectConversation } from "@/server/messaging";
import { reportConsultant, reportConsultantInput, setConsultantSaved } from "@/server/consultants";

const idInput = z.object({ consultantId: z.string().uuid() });

/** Open (or reuse) the 1:1 consultant thread; the client redirects to it. */
export async function messageConsultantAction(raw: z.input<typeof idInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const { consultantId } = idInput.parse(raw);
    const convo = await ensureDirectConversation(viewer.userId, consultantId, "consultant");
    return { conversationId: convo.id };
  });
}

const saveInput = idInput.extend({ saved: z.boolean() });

export async function saveConsultantAction(raw: z.input<typeof saveInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const { consultantId, saved } = saveInput.parse(raw);
    const result = await setConsultantSaved(viewer.userId, consultantId, saved);
    revalidatePath("/saved");
    return { saved: result };
  });
}

export async function reportConsultantAction(raw: z.input<typeof reportConsultantInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await reportConsultant(viewer.userId, raw);
  });
}
