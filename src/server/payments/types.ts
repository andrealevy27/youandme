import type { PricingType } from "@/lib/domain";

/** Everything a provider needs to open a checkout. Built by the payments service — never from client input. */
export type CheckoutRequest = {
  bookingId: string;
  paymentId: string;
  serviceTitle: string;
  pricingType: PricingType;
  billingInterval: "day" | "week" | "month" | "year";
  amountCents: number;
  platformFeeCents: number;
  platformFeeBps: number;
  currency: string;
  clientEmail: string;
  consultantStripeAccountId: string | null;
};

export type CheckoutResult = {
  redirectUrl: string;
  checkoutId: string;
  /** Set when the provider confirmed payment synchronously (dev provider only). */
  confirmed?: { paymentId: string | null; subscriptionId: string | null };
};

/** Provider-neutral webhook events — the payments service applies them to the database. */
export type PaymentEvent =
  | { type: "checkout_completed"; checkoutId: string; paymentId: string | null; subscriptionId: string | null; paid: boolean }
  | { type: "checkout_expired"; checkoutId: string }
  | { type: "refunded"; paymentId: string; fully: boolean }
  | { type: "disputed"; paymentId: string; reason: string | null }
  | { type: "account_updated"; accountId: string; chargesEnabled: boolean }
  | { type: "ignored"; providerType: string };

export type RefundablePayment = {
  providerPaymentId: string | null;
  providerSubscriptionId: string | null;
  amountCents: number;
};

export interface PaymentProvider {
  readonly name: "stripe" | "dev";
  /** True when the provider moves no real money (UI must show a test-mode banner). */
  readonly testMode: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Verify and normalise an incoming webhook. Throws on an invalid signature. */
  handleWebhook(req: Request): Promise<{ id: string; event: PaymentEvent }>;
  refund(payment: RefundablePayment): Promise<{ refundId: string | null }>;
}
