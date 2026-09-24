/**
 * Weights → rounded percentages that always sum to exactly 100 (largest-remainder
 * rounding), or all zeros when every weight is 0. Pure and isomorphic.
 */
export function normaliseWeights<K extends string>(keys: readonly K[], weights: Partial<Record<K, number>>): Record<K, number> {
  const clean = keys.map((k) => {
    const v = weights[k];
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  });
  const total = clean.reduce((a, b) => a + b, 0);
  const out = {} as Record<K, number>;
  if (total === 0) {
    for (const k of keys) out[k] = 0;
    return out;
  }
  const exact = clean.map((v) => (v / total) * 100);
  const floored = exact.map(Math.floor);
  let remaining = 100 - floored.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floored[i]! += 1;
    remaining -= 1;
  }
  keys.forEach((k, i) => (out[k] = floored[i]!));
  return out;
}
