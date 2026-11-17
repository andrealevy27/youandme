import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JoinEventButton } from "@/components/student/join-event-button";
import { StudentPrivacyNote } from "@/components/student/privacy-note";
import { getViewer } from "@/server/auth/session";
import { env } from "@/server/env";
import { formatEventTime, getEventByCode, isAttendee } from "@/server/events";
import { schoolBySlug } from "@/lib/schools";

export const metadata: Metadata = { title: "Join event", robots: { index: false } };

/** Public landing for an event's QR code / join link. Works signed out, on a phone. */
export default async function EventJoinPage({ params }: { params: Promise<{ code: string }> }) {
  if (!env.STUDENT_MODE) notFound();
  const { code } = await params;
  const event = await getEventByCode(code);
  if (!event) notFound();
  const viewer = await getViewer().catch(() => null);
  if (viewer?.onboarded && (await isAttendee(event.id, viewer.userId))) redirect(`/events/${event.code}`);

  const here = `/e/${event.code}`;
  const school = schoolBySlug(event.school);
  const closed = event.status !== "active";

  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="rounded-[24px] border border-border bg-card p-6 shadow-soft sm:p-8">
          <p className="text-[13px] font-medium text-brand-ink">You&apos;re invited</p>
          <h1 className="mt-1.5 text-[28px] leading-tight font-semibold tracking-tight">{event.name}</h1>
          <ul className="mt-4 space-y-1.5 text-[14px] text-muted">
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" aria-hidden /> {formatEventTime(event)}
            </li>
            {event.location && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden /> {event.location}
              </li>
            )}
            <li className="flex items-center gap-2">
              <Users className="size-4 shrink-0" aria-hidden /> {school ? `For ${school.name} students` : "Open to students from any school"}
            </li>
          </ul>
          {event.description && <p className="mt-4 text-[14.5px] leading-relaxed whitespace-pre-line">{event.description}</p>}

          <div className="mt-6 border-t border-border pt-6">
            {closed ? (
              <p className="text-[14.5px] text-muted">This event has ended. If you attended, your introductions are under Events in the app.</p>
            ) : !viewer ? (
              <>
                <p className="text-[14.5px] text-muted">Answer a few quick questions and get your five people to meet tonight — with a reason for each.</p>
                <div className="mt-5 flex flex-col gap-2.5">
                  <Button asChild size="lg" className="h-12">
                    <Link href={`/signup?next=${encodeURIComponent(here)}`}>Join with your school email</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary" className="h-12">
                    <Link href={`/login?next=${encodeURIComponent(here)}`}>I already have an account</Link>
                  </Button>
                </div>
              </>
            ) : !viewer.onboarded ? (
              <>
                <p className="text-[14.5px] text-muted">Finish your profile (about 2 minutes) to get your introductions.</p>
                <Button asChild size="lg" className="mt-5 h-12 w-full">
                  <Link href={`/onboarding?next=${encodeURIComponent(here)}`}>Finish my profile</Link>
                </Button>
              </>
            ) : (
              <JoinEventButton code={event.code} />
            )}
          </div>
        </div>
        <StudentPrivacyNote className="mt-5" />
      </div>
    </section>
  );
}
