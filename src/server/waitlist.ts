import "server-only";
import { db } from "./db";
import { waitlistEntries } from "./db/schema";
import { emailLayout, sendEmail, WAITLIST_FOOTER } from "./email";
import { escapeHtml } from "./admin/utils";

export type WaitlistSignup = { email: string; name: string; intent: string; note?: string };

/**
 * Adds someone to the waitlist and confirms by email. Joining twice is a no-op
 * (no second email), and callers get the same result either way so the public
 * form never reveals whether an address is already on the list.
 */
export async function joinWaitlist(input: WaitlistSignup) {
  const email = input.email.trim().toLowerCase();
  const [created] = await db
    .insert(waitlistEntries)
    .values({ email, name: input.name, intent: input.intent, note: input.note || null })
    .onConflictDoNothing()
    .returning({ id: waitlistEntries.id });

  if (created) {
    const first = input.name.trim().split(" ")[0];
    const greeting = first ? `Hi ${first},` : "Hi,";
    await sendEmail({
      to: email,
      subject: "You're on the You&Me waitlist",
      text: `${greeting}\n\nThanks for joining the You&Me waitlist. We're opening in waves so every match stays worth your time — we'll email you here as soon as your spot opens.\n\nThe You&Me team`,
      html: emailLayout(
        "You're on the list",
        `${escapeHtml(greeting)}<br/><br/>Thanks for joining the You&amp;Me waitlist. We're opening in waves so every match stays worth your time — we'll email you here as soon as your spot opens.`,
        undefined,
        WAITLIST_FOOTER,
      ),
    });
  }
  return { created: !!created };
}
