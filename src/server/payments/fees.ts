/** Pure fee math. Amounts are integer minor units (cents). */

export const MAX_FEE_BPS = 5000;

/**
 * Platform commission for an amount, in basis points (1000 = 10%).
 * Rounded half-up to the nearest cent, clamped to [0, amount].
 */
export function computePlatformFee(amountCents: number, feeBps: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const bps = Math.max(0, Math.min(MAX_FEE_BPS, Math.floor(Number.isFinite(feeBps) ? feeBps : 0)));
  const fee = Math.round((Math.round(amountCents) * bps) / 10_000);
  return Math.max(0, Math.min(Math.round(amountCents), fee));
}

/** Stripe subscriptions take a percentage (up to 2 decimals) instead of a fixed fee. */
export function feeBpsToPercent(feeBps: number): number {
  const bps = Math.max(0, Math.min(MAX_FEE_BPS, Math.floor(feeBps)));
  return Math.round(bps) / 100;
}

/** What the consultant receives after the platform fee. */
export function consultantPayout(amountCents: number, platformFeeCents: number): number {
  return Math.max(0, amountCents - platformFeeCents);
}

/** Total for a booking: hourly services are priced per unit (hours); everything else is flat. */
export function bookingAmount(pricingType: "fixed" | "hourly" | "package" | "recurring", priceCents: number, quantity = 1): number {
  const q = pricingType === "hourly" ? Math.max(1, Math.floor(quantity)) : 1;
  return priceCents * q;
}
