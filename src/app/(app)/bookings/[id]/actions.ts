"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { cancelBooking, completeBooking, disputeBooking, refundBooking } from "@/server/bookings";
import { startCheckout } from "@/server/payments";
import { submitReview, submitReviewInput } from "@/server/reviews";

const idInput = z.object({ bookingId: z.string().uuid() });
const withReason = idInput.extend({ reason: z.string().max(2000).optional() });

function refresh(bookingId: string) {
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
}

export async function payBookingAction(raw: z.input<typeof idInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const { bookingId } = idInput.parse(raw);
    const res = await startCheckout(viewer.userId, bookingId);
    refresh(bookingId);
    return { redirectUrl: res.redirectUrl, external: /^https?:\/\//.test(res.redirectUrl) };
  });
}

export async function cancelBookingAction(raw: z.input<typeof withReason>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = withReason.parse(raw);
    await cancelBooking(viewer.userId, input);
    refresh(input.bookingId);
  });
}

export async function completeBookingAction(raw: z.input<typeof idInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const { bookingId } = idInput.parse(raw);
    await completeBooking(viewer.userId, bookingId);
    refresh(bookingId);
  });
}

export async function disputeBookingAction(raw: { bookingId: string; reason: string }) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await disputeBooking(viewer.userId, raw);
    refresh(raw.bookingId);
  });
}

export async function refundBookingAction(raw: z.input<typeof withReason>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = withReason.parse(raw);
    await refundBooking({ userId: viewer.userId, adminRole: viewer.adminRole }, input);
    refresh(input.bookingId);
  });
}

export async function submitReviewAction(raw: z.input<typeof submitReviewInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const review = await submitReview(viewer.userId, raw);
    refresh(review.bookingId);
    return { id: review.id };
  });
}
