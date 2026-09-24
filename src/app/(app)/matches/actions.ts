"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { expressInterest, passOn, saveFromRecommendation, unmatch } from "@/server/matching/interests";
import { markRecommendationViewed } from "@/server/recommendations";
import { track } from "@/server/analytics";

const id = z.string().min(1).max(64);

export async function interestedAction(targetId: string, note?: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const result = await expressInterest(viewer.userId, id.parse(targetId), note);
    revalidatePath("/matches");
    revalidatePath("/home");
    return result;
  });
}

export async function passAction(targetId: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await passOn(viewer.userId, id.parse(targetId));
    revalidatePath("/home");
    return { ok: true };
  });
}

export async function saveAction(targetId: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await saveFromRecommendation(viewer.userId, id.parse(targetId));
    return { ok: true };
  });
}

export async function unmatchAction(matchId: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await unmatch(viewer.userId, id.parse(matchId));
    revalidatePath("/matches/connections");
    return { ok: true };
  });
}

export async function recommendationViewedAction(recommendationId: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await markRecommendationViewed(viewer.userId, id.parse(recommendationId));
    track("recommendation_viewed", viewer.userId);
    return { ok: true };
  });
}
