"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { track } from "@/server/analytics";
import { createEvent, setEventStatus } from "@/server/events";

export async function createEventAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("events.manage");
    const event = await createEvent(viewer.userId, raw as never);
    track("event_created", viewer.userId, { eventId: event.id });
    revalidatePath("/admin/events");
    return { id: event.id, code: event.code };
  });
}

export async function setEventStatusAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("events.manage");
    const data = z.object({ id: z.string().min(1).max(128), status: z.enum(["active", "closed"]) }).parse(raw);
    await setEventStatus(viewer.userId, data.id, data.status);
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${data.id}`);
    return { ok: true };
  });
}
