import { NextResponse } from "next/server";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { getStripeProvider, processPaymentEvent } from "@/server/payments";

/**
 * Stripe webhook: verifies the signature with STRIPE_WEBHOOK_SECRET, then applies the
 * normalised event. Handlers are state-checked, so Stripe's retries are idempotent.
 * Events: checkout.session.completed / async_payment_succeeded / expired / async_payment_failed,
 * charge.refunded, charge.dispute.created, account.updated.
 */
export async function POST(req: Request) {
  const stripe = getStripeProvider();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  let verified;
  try {
    verified = await stripe.handleWebhook(req);
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Invalid webhook.";
    return NextResponse.json({ error: message }, { status: err instanceof AppError && err.code === "UNAVAILABLE" ? 503 : 400 });
  }
  try {
    const outcome = await processPaymentEvent(verified.event);
    logger.info("stripe_webhook_processed", { id: verified.id, type: verified.event.type, outcome });
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    // Non-2xx makes Stripe retry later; handlers are idempotent.
    logger.error("stripe_webhook_failed", { id: verified.id, type: verified.event.type, err });
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
