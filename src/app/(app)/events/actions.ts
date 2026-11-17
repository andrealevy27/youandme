"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { joinEvent } from "@/server/events";

export async function joinEventAction(code: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const event = await joinEvent(viewer.userId, z.string().trim().min(4).max(12).parse(code));
    revalidatePath("/events");
    return { code: event.code };
  });
}
