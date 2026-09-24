import "server-only";
import { cookies, headers } from "next/headers";
import { findUsableInvite, INVITE_COOKIE } from "@/server/auth/lifecycle";

/** Best-effort client IP for rate limiting (first hop of x-forwarded-for). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** The invite currently stored in the signup cookie, if it's still usable. */
export async function currentInvite() {
  const code = (await cookies()).get(INVITE_COOKIE)?.value;
  return code ? findUsableInvite(code).catch(() => null) : null;
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | string[] | undefined, fallback = "/home") {
  const v = Array.isArray(next) ? next[0] : next;
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

/** Store a validated invite code in the httpOnly cookie read by signup. Server actions / route handlers only. */
export async function setInviteCookie(code: string) {
  (await cookies()).set(INVITE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
