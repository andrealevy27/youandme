import "server-only";
import { cache } from "react";
import { getViewer } from "@/server/auth/session";
import { getSetting } from "@/server/settings";

/** Per-request public-site context: who's looking and which access mode is on. */
export const getMarketingContext = cache(async () => {
  const [viewer, inviteOnly, waitlistEnabled] = await Promise.all([
    getViewer().catch(() => null),
    getSetting("invite_only").catch(() => false),
    getSetting("waitlist_enabled").catch(() => false),
  ]);
  return {
    signedIn: !!viewer,
    inviteOnly,
    waitlistEnabled,
    showWaitlist: inviteOnly || waitlistEnabled,
  };
});
