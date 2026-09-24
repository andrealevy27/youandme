import Stripe from "stripe";
import { env, features } from "../env";
import { AppError } from "../errors";
import { logger } from "../logger";
import type { CheckoutRequest, CheckoutResult, PaymentEvent, PaymentProvider, RefundablePayment } from "./types";

let client: Stripe | null = null;

/** Lazily constructed Stripe client; null when Stripe isn't configured. */
export function getStripe(): Stripe | null {
  if (!features.stripe) return null;
  client ??= new Stripe(env.STRIPE_SECRET_KEY!, { appInfo: { name: "You&Me" }, maxNetworkRetries: 2 });
  return client;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

/**
 * Stripe Connect via Checkout + destination charges. The platform keeps
 * `application_fee_amount` (or `application_fee_percent` for subscriptions);
 * the rest is transferred to the consultant's connected account.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly testMode = env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;
  private stripe: Stripe;

  constructor() {
    const s = getStripe();
    if (!s) throw new AppError("UNAVAILABLE", "Payments aren't configured on this environment.");
    this.stripe = s;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    if (!req.consultantStripeAccountId) throw new AppError("UNAVAILABLE", "This consultant can't accept payments yet.");
    const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const metadata = { bookingId: req.bookingId, paymentId: req.paymentId };
    const common = {
      client_reference_id: req.bookingId,
      customer_email: req.clientEmail,
      metadata,
      success_url: `${base}/bookings/${req.bookingId}?checkout=success`,
      cancel_url: `${base}/bookings/${req.bookingId}?checkout=cancelled`,
      // Stripe's minimum; matches the booking's slot hold.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    } satisfies Partial<Stripe.Checkout.SessionCreateParams>;
    const productData = { name: req.serviceTitle.slice(0, 250) };

    const params: Stripe.Checkout.SessionCreateParams =
      req.pricingType === "recurring"
        ? {
            ...common,
            mode: "subscription",
            line_items: [
              {
                quantity: 1,
                price_data: { currency: req.currency, unit_amount: req.amountCents, product_data: productData, recurring: { interval: req.billingInterval } },
              },
            ],
            subscription_data: {
              metadata,
              application_fee_percent: Math.round(req.platformFeeBps) / 100,
              transfer_data: { destination: req.consultantStripeAccountId },
            },
          }
        : {
            ...common,
            mode: "payment",
            line_items: [{ quantity: 1, price_data: { currency: req.currency, unit_amount: req.amountCents, product_data: productData } }],
            payment_intent_data: {
              metadata,
              application_fee_amount: req.platformFeeCents,
              transfer_data: { destination: req.consultantStripeAccountId },
            },
          };

    const session = await this.stripe.checkout.sessions.create(params, { idempotencyKey: `checkout_${req.paymentId}` });
    if (!session.url) throw new AppError("UNAVAILABLE", "Stripe didn't return a checkout link. Please try again.");
    return { redirectUrl: session.url, checkoutId: session.id };
  }

  async handleWebhook(req: Request): Promise<{ id: string; event: PaymentEvent }> {
    if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError("UNAVAILABLE", "Webhook secret not configured.");
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new AppError("VALIDATION", "Missing signature.");
    const body = await req.text();
    let evt: Stripe.Event;
    try {
      evt = this.stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn("stripe_webhook_bad_signature", { err });
      throw new AppError("VALIDATION", "Invalid signature.");
    }
    return { id: evt.id, event: await this.normalise(evt) };
  }

  private async normalise(evt: Stripe.Event): Promise<PaymentEvent> {
    switch (evt.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = evt.data.object;
        const subscriptionId = idOf(s.subscription);
        let paymentId = idOf(s.payment_intent);
        if (!paymentId && subscriptionId && s.invoice) paymentId = await this.subscriptionPaymentIntent(idOf(s.invoice)!);
        const paid = s.payment_status === "paid" || s.payment_status === "no_payment_required";
        return { type: "checkout_completed", checkoutId: s.id, paymentId, subscriptionId, paid };
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        return { type: "checkout_expired", checkoutId: evt.data.object.id };
      case "charge.refunded": {
        const c = evt.data.object;
        const pi = idOf(c.payment_intent);
        return pi ? { type: "refunded", paymentId: pi, fully: c.refunded } : { type: "ignored", providerType: evt.type };
      }
      case "charge.dispute.created": {
        const d = evt.data.object;
        const pi = idOf(d.payment_intent);
        return pi ? { type: "disputed", paymentId: pi, reason: d.reason ?? null } : { type: "ignored", providerType: evt.type };
      }
      case "account.updated": {
        const a = evt.data.object;
        return { type: "account_updated", accountId: a.id, chargesEnabled: !!a.charges_enabled };
      }
      default:
        return { type: "ignored", providerType: evt.type };
    }
  }

  /** First invoice's PaymentIntent for a subscription checkout (so it can be refunded later). */
  private async subscriptionPaymentIntent(invoiceId: string): Promise<string | null> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId, { expand: ["payments"] });
      const first = invoice.payments?.data?.[0];
      return idOf(first?.payment?.payment_intent);
    } catch (err) {
      logger.warn("stripe_invoice_lookup_failed", { err });
      return null;
    }
  }

  async refund(payment: RefundablePayment) {
    if (payment.providerSubscriptionId) {
      await this.stripe.subscriptions.cancel(payment.providerSubscriptionId).catch((err: unknown) => {
        logger.warn("stripe_subscription_cancel_failed", { err });
      });
    }
    if (!payment.providerPaymentId) {
      throw new AppError("UNAVAILABLE", "This payment can't be refunded automatically. Our team has been notified.");
    }
    const refund = await this.stripe.refunds.create(
      { payment_intent: payment.providerPaymentId, reverse_transfer: true, refund_application_fee: true },
      { idempotencyKey: `refund_${payment.providerPaymentId}` },
    );
    return { refundId: refund.id };
  }

  // ── Connect onboarding ────────────────────────────────────────────────────

  async createConnectedAccount(email: string, userId: string): Promise<string> {
    const account = await this.stripe.accounts.create(
      {
        type: "express",
        email,
        metadata: { userId },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      },
      { idempotencyKey: `connect_${userId}` },
    );
    return account.id;
  }

  async createOnboardingLink(accountId: string): Promise<string> {
    const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${base}/consultant?stripe=refresh#payouts`,
      return_url: `${base}/consultant?stripe=return#payouts`,
    });
    return link.url;
  }

  async getAccountStatus(accountId: string) {
    const a = await this.stripe.accounts.retrieve(accountId);
    return { chargesEnabled: !!a.charges_enabled, detailsSubmitted: !!a.details_submitted, payoutsEnabled: !!a.payouts_enabled };
  }

  async createDashboardLink(accountId: string): Promise<string> {
    const link = await this.stripe.accounts.createLoginLink(accountId);
    return link.url;
  }
}
