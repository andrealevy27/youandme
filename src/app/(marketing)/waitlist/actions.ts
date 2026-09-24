"use server";
import { z } from "zod";
import { db } from "@/server/db";
import { waitlistEntries } from "@/server/db/schema";
import { runAction } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { clientIp } from "@/components/auth/request";
import { WAITLIST_INTENTS } from "@/components/marketing/waitlist-intents";

const input = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).pipe(z.string().max(254)),
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  intent: z.enum(WAITLIST_INTENTS.map((i) => i.value) as [string, ...string[]], { message: "Choose what brings you here." }),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

/** Public waitlist signup. Duplicate emails are silently accepted so the form never reveals membership. */
export async function joinWaitlistAction(raw: z.input<typeof input>) {
  return runAction(async () => {
    enforceRateLimit("waitlist", await clientIp());
    const data = input.parse(raw);
    await db
      .insert(waitlistEntries)
      .values({ email: data.email, name: data.name, intent: data.intent, note: data.note || null })
      .onConflictDoNothing();
    return { joined: true as const };
  });
}
