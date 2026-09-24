import { features } from "../env";
import { AppError } from "../errors";
import type { PaymentProvider } from "./types";

/**
 * Development-only provider: confirms payments immediately and moves no money.
 * Refused in production by `features.devPayments`; the UI always shows a test-mode banner.
 */
export class DevPaymentProvider implements PaymentProvider {
  readonly name = "dev" as const;
  readonly testMode = true;

  constructor() {
    if (!features.devPayments) throw new AppError("UNAVAILABLE", "Test payments are disabled on this environment.");
  }

  async createCheckout(req: Parameters<PaymentProvider["createCheckout"]>[0]) {
    const suffix = crypto.randomUUID();
    return {
      checkoutId: `dev_cs_${suffix}`,
      redirectUrl: `/bookings/${req.bookingId}?checkout=success`,
      confirmed: {
        paymentId: req.pricingType === "recurring" ? null : `dev_pi_${suffix}`,
        subscriptionId: req.pricingType === "recurring" ? `dev_sub_${suffix}` : null,
      },
    };
  }

  async handleWebhook(): Promise<never> {
    throw new AppError("UNAVAILABLE", "The test payment provider has no webhooks.");
  }

  async refund() {
    return { refundId: `dev_re_${crypto.randomUUID()}` };
  }
}
