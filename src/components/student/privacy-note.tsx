import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** The plain-language privacy promise for student mode. Shown in onboarding and Settings. */
export function StudentPrivacyNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex gap-2.5 rounded-[12px] bg-surface px-3.5 py-3 text-[13px] leading-relaxed text-muted", className)}>
      <Lock className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
      <span>
        Your profile is only shown to students who have confirmed a school email and chosen to be visible themselves — never to the public web or
        search engines. FoundMate staff can see profiles to keep the community safe. You can hide your profile at any time.
      </span>
    </p>
  );
}
