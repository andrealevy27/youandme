import { getSetting, DEFAULT_MATCH_WEIGHTS } from "../settings";
import { FACTOR_KEYS, type MatchWeights } from "./types";

/** Admin-configurable weights, sanitised so a bad setting can never break matching. */
export async function getMatchWeights(): Promise<MatchWeights> {
  const raw = (await getSetting("match_weights")) as Partial<MatchWeights>;
  const out = { ...DEFAULT_MATCH_WEIGHTS };
  for (const k of FACTOR_KEYS) {
    const v = raw?.[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) out[k] = v;
  }
  return out;
}
