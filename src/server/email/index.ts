import { Resend } from "resend";
import { env, features } from "../env";
import { logger } from "../logger";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };

interface EmailProvider {
  send(msg: EmailMessage): Promise<void>;
}

const resendProvider = (): EmailProvider => {
  const client = new Resend(env.RESEND_API_KEY);
  return {
    async send(msg) {
      const { error } = await client.emails.send({ from: env.EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
      if (error) throw new Error(`Resend error: ${error.message}`);
    },
  };
};

/** Without RESEND_API_KEY, emails are logged (dev) — never silently "sent". */
const consoleProvider: EmailProvider = {
  async send(msg) {
    logger.info("email_not_sent_no_provider", { to: msg.to, subject: msg.subject, text: msg.text });
  },
};

const provider: EmailProvider = features.email ? resendProvider() : consoleProvider;

export async function sendEmail(msg: EmailMessage) {
  try {
    await provider.send(msg);
  } catch (err) {
    logger.error("email_send_failed", { err, subject: msg.subject });
  }
}

const MEMBER_FOOTER = "You're receiving this because you have a You&amp;Me account. Manage email preferences in Settings.";
export const WAITLIST_FOOTER = "You're receiving this because you joined the You&amp;Me waitlist. If that wasn't you, you can ignore this email.";

export function emailLayout(title: string, body: string, cta?: { label: string; url: string }, footer = MEMBER_FOOTER) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.url}" style="background:#17161c;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${cta.label}</a></p>`
    : "";
  return `<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#17161c">
<p style="font-weight:700;letter-spacing:-0.02em;font-size:18px">You&amp;Me</p>
<h1 style="font-size:22px;letter-spacing:-0.02em">${title}</h1>
<div style="font-size:15px;line-height:1.6;color:#3f3d47">${body}</div>${button}
<p style="font-size:12px;color:#8a8794;margin-top:40px">${footer}</p></div>`;
}
