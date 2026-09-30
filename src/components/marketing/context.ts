import "server-only";
import { cache } from "react";
import { getViewer } from "@/server/auth/session";
import { getSetting } from "@/server/settings";

export type MarketingCta = { href: string; label: string };

/** Per-request public-site context: who's looking and which access mode is on. */
export const getMarketingContext = cache(async () => {
  const [viewer, inviteOnly, waitlistEnabled, waitlistOnly] = await Promise.all([
    getViewer().catch(() => null),
    getSetting("invite_only").catch(() => false),
    getSetting("waitlist_enabled").catch(() => false),
    getSetting("waitlist_only").catch(() => false),
  ]);
  // Invite-only is pre-launch mode: visitors can't sign up without a code, so the main CTA is the waitlist.
  const primaryCta: MarketingCta = viewer
    ? { href: "/home", label: "Open app" }
    : inviteOnly || waitlistOnly
      ? { href: "/waitlist", label: "Join the waitlist" }
      : { href: "/signup", label: "Join You&Me" };
  return {
    signedIn: !!viewer,
    primaryCta,
    inviteOnly,
    waitlistEnabled,
    /** Signed-out visitors get the waitlist and nothing else. */
    waitlistOnlyView: waitlistOnly && !viewer,
    showWaitlist: inviteOnly || waitlistEnabled || waitlistOnly,
  };
});
