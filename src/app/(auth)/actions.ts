"use server";
import { z } from "zod";
import { AppError, runAction } from "@/server/errors";
import { findUsableInvite } from "@/server/auth/lifecycle";
import { enforceRateLimit } from "@/server/rate-limit";
import { clientIp, setInviteCookie } from "@/components/auth/request";

const input = z.object({ code: z.string().trim().min(3, "Enter your invite code.").max(64) });

/**
 * Validates an invite code and stores it in the httpOnly `ym_invite` cookie.
 * Signup (email and OAuth) reads that cookie server-side in `assertSignupAllowed`.
 */
export async function redeemInviteCodeAction(raw: z.input<typeof input>) {
  return runAction(async () => {
    enforceRateLimit("invite", await clientIp());
    const { code } = input.parse(raw);
    const invite = await findUsableInvite(code);
    if (!invite) throw new AppError("NOT_FOUND", "That invite code isn't valid or has expired.");
    await setInviteCookie(invite.code);
    return { ok: true as const };
  });
}
