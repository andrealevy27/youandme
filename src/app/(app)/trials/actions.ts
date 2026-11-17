"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { checkIn, setChecklistItem, startTrial } from "@/server/trials";

const id = z.string().min(1).max(64);

export async function startTrialAction(matchId: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const trial = await startTrial(viewer.userId, id.parse(matchId));
    revalidatePath("/matches/connections");
    return { id: trial.id };
  });
}

export async function setChecklistItemAction(trialId: string, key: string, done: boolean) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await setChecklistItem(viewer.userId, id.parse(trialId), key, z.boolean().parse(done));
    revalidatePath(`/trials/${trialId}`);
    return { ok: true };
  });
}

export async function checkInAction(trialId: string, decision: "continue" | "stop") {
  return runAction(async () => {
    const viewer = await requireViewer();
    const res = await checkIn(viewer.userId, id.parse(trialId), decision);
    revalidatePath(`/trials/${trialId}`);
    return res;
  });
}
