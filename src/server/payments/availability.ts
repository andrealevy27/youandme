import { env, features } from "../env";

export type PaymentMode = "stripe" | "dev" | "none";

/** Which payment provider this environment uses. Dev payments win only when explicitly enabled (never in production). */
export function paymentMode(): PaymentMode {
  if (env.PAYMENTS_PROVIDER === "dev" && features.devPayments) return "dev";
  if (features.stripe) return "stripe";
  if (features.devPayments) return "dev";
  return "none";
}

export type PaymentAvailability =
  | { payable: true; mode: "stripe" | "dev"; testMode: boolean }
  | { payable: false; mode: PaymentMode; reason: string };

/** Can a client pay this consultant right now? Honest reasons when not. */
export function paymentAvailability(consultant: { stripeAccountId: string | null; stripeChargesEnabled: boolean }): PaymentAvailability {
  const mode = paymentMode();
  if (mode === "dev") return { payable: true, mode, testMode: true };
  if (mode === "none") {
    return { payable: false, mode, reason: "Online payments aren't set up on this environment yet, so bookings can't be paid here. Message the consultant to arrange a session." };
  }
  if (!consultant.stripeAccountId || !consultant.stripeChargesEnabled) {
    return { payable: false, mode, reason: "This consultant hasn't finished setting up payouts, so they can't take bookings yet. Send them a message instead." };
  }
  return { payable: true, mode, testMode: env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false };
}
