import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "./db";
import { platformSettings } from "./db/schema";
import type { MatchWeights } from "./matching/types";

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  skills: 25,
  goals: 15,
  commitment: 15,
  industry: 10,
  personality: 15,
  workingStyle: 10,
  location: 5,
  availability: 5,
};

/** Every runtime setting with its default. Admins edit these; code never hardcodes them elsewhere. */
export const SETTING_DEFAULTS = {
  match_weights: DEFAULT_MATCH_WEIGHTS,
  daily_recommendation_limit: 5,
  pass_cooldown_days: 45,
  invite_only: false,
  waitlist_enabled: false,
  /** Marketplace commission in basis points (1000 = 10%). */
  platform_fee_bps: 1000,
  /** You&Me Pro paid features stay off until explicitly enabled. */
  pro_enabled: false,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K] extends number
  ? number
  : (typeof SETTING_DEFAULTS)[K] extends boolean
    ? boolean
    : (typeof SETTING_DEFAULTS)[K];

const cache = new Map<string, { value: unknown; at: number }>();
const TTL_MS = 30_000;

export async function getSetting<K extends SettingKey>(key: K, conn: DbOrTx = db): Promise<SettingValue<K>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as SettingValue<K>;
  const [row] = await conn.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  const value = (row?.value ?? SETTING_DEFAULTS[key]) as SettingValue<K>;
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>, actorId: string | null) {
  await db
    .insert(platformSettings)
    .values({ key, value, updatedById: actorId })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedById: actorId } });
  cache.delete(key);
}

export function clearSettingsCache() {
  cache.clear();
}
