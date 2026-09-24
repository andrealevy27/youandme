import "server-only";
import { logger } from "../logger";

/**
 * Refunds are owned by the payments service (`@/server/payments`). The admin panel
 * binds to it at runtime so it keeps working while that service is still being built:
 * if `refundBooking(bookingId, actorId)` isn't exported, the refund button is disabled.
 */
type RefundFn = (bookingId: string, actorId: string) => Promise<unknown>;

export async function loadRefundBooking(): Promise<RefundFn | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- the payments module may not exist (or not export refundBooking) yet; checked at runtime below.
    const mod: unknown = await import("@/server/payments");
    const fn = mod && typeof mod === "object" ? (mod as Record<string, unknown>).refundBooking : undefined;
    return typeof fn === "function" ? (fn as RefundFn) : null;
  } catch (err) {
    logger.warn("admin_refund_service_unavailable", { err });
    return null;
  }
}

export async function refundsAvailable() {
  return (await loadRefundBooking()) !== null;
}
