import { env } from "@/server/env";
import type { Metadata } from "next";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { listMatches, listPendingInterests } from "@/server/matching/interests";
import { MatchesTabs } from "@/components/matching/matches-tabs";
import { UnmatchButton } from "@/components/matching/unmatch-button";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { formatRelative } from "@/lib/utils";
import { listMyTrials, trialOutcome } from "@/server/trials";
import { StartTrialButton } from "@/components/student/trial-controls";

export const metadata: Metadata = { title: "Your matches" };

export default async function ConnectionsPage() {
  const viewer = await requireViewerPage();
  const [matches, pending, trials] = await Promise.all([
    listMatches(viewer.userId),
    listPendingInterests(viewer.userId),
    env.STUDENT_MODE ? listMyTrials(viewer.userId) : Promise.resolve([]),
  ]);
  // Latest trial per match (list is newest first).
  const trialByMatch = new Map<string, (typeof trials)[number]>();
  for (const t of trials) if (!trialByMatch.has(t.matchId)) trialByMatch.set(t.matchId, t);
  const TRIAL_LABEL = { active: "Trial in progress", check_in: "Trial: time to check in", continuing: "Continuing as cofounders", stopped: "Trial ended" } as const;
  return (
    <>
      <PageHeader eyebrow="Cofounder matching" title="Your matches" description="People who are interested in building with you — and you with them." />
      <MatchesTabs active="connections" />
      <section className="mb-10">
        <SectionHeader title="Mutual matches" />
        {matches.length === 0 ? (
          <EmptyState
            icon={<Heart />}
            title="No matches yet"
            description="When someone you're interested in is interested back, they'll show up here and you can message each other."
            action={
              <Button asChild>
                <Link href="/matches">Review today&apos;s picks</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {matches.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-4 rounded-[16px] border border-border bg-card p-4">
                <Avatar name={m.person.name} src={m.person.avatarUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <Link href={`/people/${m.person.handle}`} className="font-medium hover:underline">
                    {m.person.name}
                  </Link>
                  {m.person.isDemo && <DemoBadge className="ml-2" />}
                  <p className="truncate text-sm text-muted">{m.person.headline ?? m.person.currentRole}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    Matched {formatRelative(m.createdAt)} {m.score !== null && !env.STUDENT_MODE && `· ${m.score}% compatibility`}
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:flex-col">
                  {m.conversationId && (
                    <Button size="sm" asChild>
                      <Link href={`/messages/${m.conversationId}`}>
                        <MessageCircle /> Message
                      </Link>
                    </Button>
                  )}
                  {env.STUDENT_MODE &&
                    (trialByMatch.get(m.id) ? (
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/trials/${trialByMatch.get(m.id)!.id}`}>{TRIAL_LABEL[trialOutcome(trialByMatch.get(m.id)!)]}</Link>
                      </Button>
                    ) : (
                      <StartTrialButton matchId={m.id} />
                    ))}
                  <UnmatchButton matchId={m.id} name={m.person.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <SectionHeader title="Waiting to hear back" description="You've said you're interested. We'll tell you if it's mutual." />
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Nobody pending right now.</p>
        ) : (
          <ul className="divide-y divide-border rounded-[16px] border border-border bg-card">
            {pending.map(({ person, at }) =>
              person ? (
                <li key={person.userId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={person.name} src={person.avatarUrl} size="sm" />
                  <Link href={`/people/${person.handle}`} className="flex-1 truncate text-sm font-medium hover:underline">
                    {person.name}
                  </Link>
                  <span className="text-xs text-subtle">{formatRelative(at)}</span>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>
    </>
  );
}
