"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { getAvailableSlotsForService } from "@/server/consultants";
import { cancelBooking, createBooking } from "@/server/bookings";
import { startCheckout } from "@/server/payments";

const slotsInput = z.object({ serviceId: z.string().uuid() });

export async function getSlotsAction(raw: z.input<typeof slotsInput>) {
  return runAction(async () => {
    await requireViewer();
    const { serviceId } = slotsInput.parse(raw);
    const res = await getAvailableSlotsForService(serviceId, new Date(), 21);
    return { hasRules: res.hasRules, slots: res.slots.map((s) => s.startsAt.toISOString()) };
  });
}

const bookInput = z.object({
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime(),
  projectContext: z.string().max(4000).optional(),
  startupId: z.string().uuid().nullish(),
  teammateIds: z.array(z.string().uuid()).max(10).default([]),
  groupChat: z.boolean().default(false),
});

/** Create the booking (slot re-validated server-side) and open checkout. */
export async function bookAndPayAction(raw: z.input<typeof bookInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = bookInput.parse(raw);
    const booking = await createBooking(viewer.userId, {
      serviceId: input.serviceId,
      startsAt: new Date(input.startsAt),
      projectContext: input.projectContext,
      startupId: input.startupId ?? null,
      teammateIds: input.teammateIds,
      timezone: viewer.timezone,
    });
    let checkout;
    try {
      checkout = await startCheckout(viewer.userId, booking.id, { groupChat: input.groupChat && input.teammateIds.length > 0 });
    } catch (err) {
      // Don't hold the consultant's slot for a checkout that never opened.
      await cancelBooking(viewer.userId, { bookingId: booking.id, reason: "Checkout could not be started." }).catch(() => undefined);
      throw err;
    }
    revalidatePath("/bookings");
    return { bookingId: booking.id, redirectUrl: checkout.redirectUrl, external: /^https?:\/\//.test(checkout.redirectUrl) };
  });
}
