import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChecklistItem, CheckInButtons } from "@/components/student/trial-controls";
import { requireViewerPage } from "@/server/auth/session";
import { db } from "@/server/db";
import { matches } from "@/server/db/schema";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { getPersonSummaries } from "@/server/people";
import { TRIAL_CHECKLIST, daysLeft, getTrial, trialOutcome } from "@/server/trials";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Cofounder trial" };

export default async function TrialPage({ params }: { params: Promise<{ id: string }> }) {
  if (!env.STUDENT_MODE) notFound();
  const viewer = await requireViewerPage();
  const { id } = await params;
  const trial = await getTrial(viewer.userId, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const otherId = trial.userAId === viewer.userId ? trial.userBId : trial.userAId;
  const [[other], [match]] = await Promise.all([
    getPersonSummaries([otherId]),
    db.select({ conversationId: matches.conversationId }).from(matches).where(eq(matches.id, trial.matchId)),
  ]);
  const first = other?.name.split(" ")[0] ?? "your match";
  const outcome = trialOutcome(trial);
  const mine = (trial.userAId === viewer.userId ? trial.decisionA : trial.decisionB) as "continue" | "stop" | null;
  const left = daysLeft(trial);
  const done = TRIAL_CHECKLIST.filter((c) => trial.checklist[c.key]).length;
  const closed = !!trial.closedAt;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="animate-fade-up">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink">
          <FlaskConical className="size-4" aria-hidden /> 2-week cofounder trial
        </p>
        <div className="mt-3 flex items-center gap-3">
          {other && <Avatar name={other.name} src={other.avatarUrl} size="lg" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] leading-tight font-semibold tracking-tight sm:text-[30px]">You &amp; {other?.name ?? "your match"}</h1>
            <p className="text-[14px] text-muted">
              {outcome === "continuing"
                ? "You both chose to continue. 🎉"
                : outcome === "stopped"
                  ? "This trial has ended."
                  : outcome === "check_in"
                    ? "Two weeks are up — time to check in."
                    : `${left} day${left === 1 ? "" : "s"} left · ${done} of ${TRIAL_CHECKLIST.length} conversations done`}
            </p>
          </div>
          {match?.conversationId && (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/messages/${match.conversationId}`}>
                <MessageCircle /> Chat
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold tracking-tight">Six conversations to have</h2>
        <p className="mt-1 text-[13.5px] text-muted">Tick each one off once you&apos;ve actually talked it through — ideally in person. You both see the same list.</p>
        <ul className="mt-4 space-y-2.5">
          {TRIAL_CHECKLIST.map((c) => (
            <ChecklistItem key={c.key} trialId={trial.id} itemKey={c.key} title={c.title} prompt={c.prompt} initialDone={!!trial.checklist[c.key]} disabled={closed} />
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-[18px] border border-border bg-card p-5 shadow-soft">
        <h2 className="text-[15px] font-semibold tracking-tight">Check-in</h2>
        {closed ? (
          <p className="mt-2 text-[14px] text-muted">
            {outcome === "continuing"
              ? `You and ${first} both said continue. Keep building — and revisit the checklist whenever things change.`
              : "One of you chose to stop. That's a good outcome too: you found out in two weeks, not two years."}
          </p>
        ) : (
          <>
            <p className="mt-1 mb-4 text-[13.5px] text-muted">
              {outcome === "check_in" ? `Do you want to keep building with ${first}?` : `You can check in any time — most pairs do it at the end of the two weeks.`}{" "}
              {first} only sees your answer once you&apos;ve both checked in, or if either of you stops.
            </p>
            <CheckInButtons trialId={trial.id} mine={mine} />
          </>
        )}
      </section>
    </div>
  );
}
