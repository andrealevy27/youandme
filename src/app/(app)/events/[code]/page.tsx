import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { IntroCard } from "@/components/student/intro-card";
import { RefreshButton } from "@/components/student/refresh-button";
import { VerifiedStudentGate } from "@/components/student/verify-gate";
import { requireViewerPage } from "@/server/auth/session";
import { env } from "@/server/env";
import { INTROS_PER_EVENT, formatEventTime, getEventByCode, getEventIntroductions, isAttendee } from "@/server/events";

export const metadata: Metadata = { title: "Your people to meet" };

export default async function EventIntrosPage({ params }: { params: Promise<{ code: string }> }) {
  if (!env.STUDENT_MODE) notFound();
  const viewer = await requireViewerPage();
  const { code } = await params;
  const event = await getEventByCode(code);
  if (!event) notFound();
  if (!(await isAttendee(event.id, viewer.userId))) redirect(`/e/${event.code}`);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="animate-fade-up">
        <p className="text-[13px] font-medium text-brand-ink">{event.name}</p>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight sm:text-[36px]">
          {event.status === "active" ? `Your ${INTROS_PER_EVENT} people to meet tonight` : "Who you met"}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-[14px] text-muted">
          <CalendarDays className="size-4" aria-hidden /> {formatEventTime(event)}
        </p>
      </header>
      <div className="mt-6">
        <VerifiedStudentGate>
          <Intros viewer={viewer} eventId={event.id} active={event.status === "active"} />
        </VerifiedStudentGate>
      </div>
    </div>
  );
}

async function Intros({ viewer, eventId, active }: { viewer: { userId: string; adminRole: string | null }; eventId: string; active: boolean }) {
  const intros = await getEventIntroductions(viewer, eventId);
  if (!intros.length) {
    return (
      <EmptyState
        icon={<Users />}
        title={active ? "You're one of the first here" : "No introductions for this event"}
        description={active ? "As more people join, your introductions will appear here. Check back in a few minutes." : "Introductions only appear for people who joined while the event was running."}
        action={active ? <RefreshButton /> : undefined}
      />
    );
  }
  return (
    <>
      <ol className="space-y-3">
        {intros.map((i) => (
          <IntroCard key={i.person.userId} intro={i} rank={i.rank} />
        ))}
      </ol>
      <p className="mt-5 text-center text-[13px] text-subtle">
        Say yes to anyone you&apos;d like to build with. If they say yes too, you&apos;ll match and can message — tonight or after.
      </p>
      {active && intros.length < INTROS_PER_EVENT && (
        <div className="mt-4 flex justify-center">
          <RefreshButton label="Check for more people" />
        </div>
      )}
    </>
  );
}
