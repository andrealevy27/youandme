import { MailCheck } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { env, features } from "@/server/env";
import { canSeeStudents } from "@/server/student";
import { ResendVerificationButton } from "./resend-verification";

/**
 * Student mode privacy rule: only students who have confirmed their school email can see other
 * students. Everyone else sees this prompt instead of the page. No-op when STUDENT_MODE is off.
 */
export async function VerifiedStudentGate({ children }: { children: React.ReactNode }) {
  if (!env.STUDENT_MODE) return <>{children}</>;
  const viewer = await requireViewerPage();
  if (await canSeeStudents(viewer)) return <>{children}</>;
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-[20px] border border-border bg-card p-6 text-center shadow-soft sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <MailCheck className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Confirm your school email</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
        We sent a link to <span className="font-medium text-foreground">{viewer.email}</span>. Profiles on FoundMate are only visible to students who
        have confirmed a school email — including yours, once you confirm.
      </p>
      <div className="mt-6 flex justify-center">
        <ResendVerificationButton email={viewer.email} />
      </div>
      {!features.email && (
        <p className="mt-4 rounded-[12px] bg-warning-soft px-3 py-2 text-[13px] text-warning">
          Email sending isn&apos;t set up on this server yet, so confirmation links can&apos;t be delivered. The site owner needs to add an email
          provider key.
        </p>
      )}
    </div>
  );
}
