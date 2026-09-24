import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/components/auth/request";
import { getViewer } from "@/server/auth/session";
import { features } from "@/server/env";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to You&Me." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getViewer().catch(() => null)) redirect(next);

  let initialError: string | null = null;
  if (typeof sp.error === "string" && sp.error) {
    const inviteOnly = await getSetting("invite_only").catch(() => false);
    initialError = inviteOnly
      ? "We couldn't sign you in with that provider. New accounts need an invite while You&Me is invite-only."
      : "We couldn't sign you in with that provider. Please try again or use your email.";
  }

  return <LoginForm oauth={{ google: features.google, apple: features.apple, linkedin: features.linkedin }} next={next} initialError={initialError} />;
}
