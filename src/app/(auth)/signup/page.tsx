import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { currentInvite } from "@/components/auth/request";
import { getViewer } from "@/server/auth/session";
import { features } from "@/server/env";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = {
  title: "Join",
  description: "Create your You&Me account and meet the people you need to build your startup.",
};

export default async function SignupPage() {
  if (await getViewer().catch(() => null)) redirect("/home");
  const [inviteOnly, waitlistEnabled] = await Promise.all([
    getSetting("invite_only").catch(() => false),
    getSetting("waitlist_enabled").catch(() => false),
  ]);
  const inviteApplied = inviteOnly ? !!(await currentInvite()) : false;

  return (
    <SignupForm
      oauth={{ google: features.google, apple: features.apple, linkedin: features.linkedin }}
      inviteOnly={inviteOnly}
      inviteApplied={inviteApplied}
      showWaitlist={inviteOnly || waitlistEnabled}
    />
  );
}
