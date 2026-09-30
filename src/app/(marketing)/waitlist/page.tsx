import type { Metadata } from "next";
import { WaitlistSection } from "@/components/marketing/waitlist-section";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description: "You&Me is letting people in carefully. Join the waitlist and we'll let you know when your spot opens.",
};

export default function WaitlistPage() {
  return <WaitlistSection />;
}
