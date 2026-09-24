"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { findUsableInvite } from "@/server/auth/lifecycle";
import { enforceRateLimit } from "@/server/rate-limit";
import { AppError } from "@/server/errors";
import { clientIp, setInviteCookie } from "@/components/auth/request";

/** Form action: re-validate the code, store it in the httpOnly invite cookie, continue to signup. */
export async function acceptInviteAction(formData: FormData) {
  const code = z.string().trim().min(1).max(64).safeParse(formData.get("code"));
  try {
    enforceRateLimit("invite", await clientIp());
  } catch (err) {
    if (err instanceof AppError) redirect(`/invite/${encodeURIComponent(code.data ?? "")}?limited=1`);
    throw err;
  }
  const invite = code.success ? await findUsableInvite(code.data) : null;
  if (!invite) redirect(`/invite/${encodeURIComponent(code.data ?? "")}`);
  await setInviteCookie(invite.code);
  redirect("/signup");
}
