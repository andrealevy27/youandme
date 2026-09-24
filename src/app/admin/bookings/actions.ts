"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { AppError, runAction } from "@/server/errors";
import { audit } from "@/server/audit";
import { loadRefundBooking } from "@/server/admin/refunds";

export async function refundBookingAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("payments.refund");
    const { bookingId } = z.object({ bookingId: z.string().trim().min(1).max(128) }).parse(raw);
    const refundBooking = await loadRefundBooking();
    if (!refundBooking) throw new AppError("UNAVAILABLE", "Refunds require the payments service, which isn't available yet.");
    await refundBooking(bookingId, viewer.userId);
    // The payments service records its own audit entry; this one ties the refund to the admin panel.
    await audit({ actorId: viewer.userId, action: "admin.refund_requested", targetType: "booking", targetId: bookingId });
    revalidatePath("/admin/bookings");
  });
}
