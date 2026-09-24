"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { AppError, runAction } from "@/server/errors";
import { audit } from "@/server/audit";
import { getSetting, setSetting, type SettingKey } from "@/server/settings";
import { FACTOR_KEYS, type MatchWeights } from "@/server/matching/types";
import { isValidWeights } from "@/server/admin/utils";
import type { Viewer } from "@/server/auth/session";

const weight = z.coerce.number().int("Weights are whole numbers.").min(0).max(100);
const weightsInput = z.object(Object.fromEntries(FACTOR_KEYS.map((k) => [k, weight])) as Record<(typeof FACTOR_KEYS)[number], typeof weight>);

async function save<K extends SettingKey>(viewer: Viewer, key: K, value: Parameters<typeof setSetting<K>>[1]) {
  const before = await getSetting(key);
  await setSetting(key, value, viewer.userId);
  await audit({ actorId: viewer.userId, action: "settings.updated", targetType: "setting", targetId: key, metadata: { before, after: value } });
}

function revalidate() {
  revalidatePath("/admin/settings");
}

export async function saveMatchWeightsAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("settings.manage");
    const weights = weightsInput.parse(raw) as MatchWeights;
    if (!isValidWeights(weights)) throw new AppError("VALIDATION", "At least one factor needs a weight above zero.");
    await save(viewer, "match_weights", weights);
    revalidate();
  });
}

export async function saveRecommendationSettingsAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("settings.manage");
    const data = z
      .object({
        daily_recommendation_limit: z.coerce.number().int().min(1, "At least 1 per day.").max(20, "At most 20 per day."),
        pass_cooldown_days: z.coerce.number().int().min(0).max(365, "At most 365 days."),
      })
      .parse(raw);
    await save(viewer, "daily_recommendation_limit", data.daily_recommendation_limit);
    await save(viewer, "pass_cooldown_days", data.pass_cooldown_days);
    revalidate();
  });
}

export async function savePlatformFeeAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("settings.manage");
    const { platform_fee_bps } = z
      .object({ platform_fee_bps: z.coerce.number().int().min(0).max(3000, "Commission can be at most 30% (3000 bps).") })
      .parse(raw);
    await save(viewer, "platform_fee_bps", platform_fee_bps);
    revalidate();
  });
}

export async function setProEnabledAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("settings.manage");
    const { value } = z.object({ value: z.boolean() }).parse(raw);
    await save(viewer, "pro_enabled", value);
    revalidate();
  });
}
