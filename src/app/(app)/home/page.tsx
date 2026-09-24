import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { ArrowRight, Briefcase, MessageCircle, Rocket, Sparkles, Users } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { getDailyRecommendations } from "@/server/recommendations";
import { getRecommendedConsultantsForUser } from "@/server/consultants/recommendations";
import { listInbox } from "@/server/messaging";
import { getPrimaryStartup, listNeedsForStartup } from "@/server/startups";
import { getRecommendedActions } from "@/server/home/actions-feed";
import { listIncomingRequests } from "@/server/connections";
import { ConsultantCard } from "@/components/consultants/consultant-card";
import { ConnectionRequests } from "@/components/home/connection-requests";
import { TeamGapsCard } from "@/components/ai/team-gaps-card";
import { EnableCofounderMatching } from "@/components/matching/enable-matching";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreRing } from "@/components/ui/progress";
import { SectionHeader } from "@/components/ui/page-header";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { STAGE_LABELS } from "@/lib/domain";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

function greeting(timezone: string) {
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(new Date()));
  } catch {}
  return hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

async function TodaysMatches({ userId, seeking }: { userId: string; seeking: boolean }) {
  if (!seeking) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Looking for a cofounder?</p>
            <p className="mt-1 text-sm text-muted">Turn on matching and meet up to five complementary people a day.</p>
          </div>
          <EnableCofounderMatching />
        </CardContent>
      </Card>
    );
  }
  const { items } = await getDailyRecommendations(userId);
  if (!items.length) {
    return (
      <EmptyState
        icon={<Users />}
        title="No matches yet"
        description="Complete your profile so we can start finding founders who complement you."
        action={
          <Button size="sm" asChild>
            <Link href="/profile/edit">Complete profile</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
      {items.map((r) => (
        <li key={r.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
          <Link href="/matches" className="flex h-full flex-col rounded-[16px] border border-border bg-card p-4 shadow-soft transition-colors hover:border-border-strong">
            <div className="flex items-center gap-3">
              <Avatar name={r.person.name} src={r.person.avatarUrl} size="lg" rounded="xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.person.name}</p>
                <p className="truncate text-[13px] text-muted">{r.person.currentRole ?? r.person.headline}</p>
                {r.person.isDemo && <DemoBadge className="mt-1" />}
              </div>
              <ScoreRing score={r.score} size={44} />
            </div>
            <p className="mt-3 line-clamp-2 text-[13px] text-muted">{r.reason}</p>
            {r.action !== "none" && (
              <Badge className="mt-3 self-start" variant={r.action === "interested" ? "brand" : "neutral"}>
                {r.action === "interested" ? "You're interested" : r.action === "saved" ? "Saved" : "Passed"}
              </Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function RecommendedConsultants({ userId }: { userId: string }) {
  const recs = await getRecommendedConsultantsForUser(userId, 3);
  if (!recs.length) {
    return (
      <EmptyState
        icon={<Briefcase />}
        title="Need help with something?"
        description="Describe what you're working on and we'll recommend experts."
        action={
          <Button size="sm" asChild>
            <Link href="/consultants">Describe what you need</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {recs.map((r) => (
        <ConsultantCard key={r.consultant.userId} c={r.consultant} reason={r.reason} />
      ))}
    </div>
  );
}

async function Conversations({ userId }: { userId: string }) {
  const inbox = (await listInbox(userId, { limit: 6 })).slice(0, 4);
  if (!inbox.length) {
    return <p className="text-sm text-muted">No conversations yet. When you match or book a consultant, your threads appear here.</p>;
  }
  return (
    <ul className="-mx-2">
      {inbox.map((c) => {
        const other = c.participants[0];
        const title = c.title ?? (c.participants.map((p) => p.name).join(", ") || "Conversation");
        return (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} className="flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-surface">
              <Avatar name={other?.name ?? title} src={other?.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className={c.unread ? "truncate text-sm font-semibold" : "truncate text-sm font-medium"}>{title}</p>
                <p className="truncate text-[13px] text-muted">{c.lastMessage?.body || (c.lastMessage ? "Attachment" : "No messages yet")}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {c.lastMessage && <span className="text-[11px] text-subtle">{formatRelative(c.lastMessage.createdAt)}</span>}
                {c.unread > 0 && <span className="size-2 rounded-full bg-brand" aria-label={`${c.unread} unread`} />}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

async function YourStartup({ userId }: { userId: string }) {
  const primary = await getPrimaryStartup(userId);
  if (!primary) {
    return (
      <Card>
        <CardContent>
          <Rocket className="mb-3 size-5 text-brand-ink" aria-hidden />
          <p className="font-medium">Build your startup identity</p>
          <p className="mt-1 text-sm text-muted">A profile, team page and list of needs — so the right people find you.</p>
          <Button size="sm" className="mt-4" asChild>
            <Link href="/startups/new">Create startup</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const s = primary.startup;
  const needs = await listNeedsForStartup(s.id);
  const fields = [s.tagline, s.description, s.problem, s.solution, s.traction, s.websiteUrl, s.logoUrl, s.fundingStatus];
  const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  return (
    <Card>
      <CardContent>
        <Link href={`/startups/${s.slug}`} className="group flex items-center gap-3">
          <Avatar name={s.name} src={s.logoUrl} size="lg" rounded="xl" />
          <div className="min-w-0">
            <p className="font-semibold group-hover:underline">{s.name}</p>
            <p className="text-[13px] text-muted">
              {STAGE_LABELS[s.stage]} · profile {completeness}% complete
            </p>
          </div>
        </Link>
        {needs.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Looking for</p>
            <div className="flex flex-wrap gap-1.5">
              {needs.slice(0, 4).map((n) => (
                <Badge key={n.id} variant="brand">
                  {n.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/startups/${s.slug}/edit`}>Edit profile</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/startups/${s.slug}/team`}>Team</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

async function Gaps({ userId }: { userId: string }) {
  const primary = await getPrimaryStartup(userId);
  if (!primary) return null;
  return <TeamGapsCard viewerId={userId} startupId={primary.startup.id} maxGaps={2} title="What your team is missing" />;
}

async function Actions({ userId }: { userId: string }) {
  const [actions, requests] = await Promise.all([getRecommendedActions(userId), listIncomingRequests(userId)]);
  return (
    <div className="space-y-4">
      {requests.length > 0 && <ConnectionRequests requests={requests.map((r) => ({ id: r.id, message: r.message, person: r.person! }))} />}
      {actions.length > 0 ? (
        <ul className="divide-y divide-border rounded-[16px] border border-border bg-card">
          {actions.map((a) => (
            <li key={a.key}>
              <Link href={a.href} className="group flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{a.description}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">You&apos;re all set. Nice work.</p>
      )}
    </div>
  );
}

function SectionFallback() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <CardSkeleton lines={1} />
      <CardSkeleton lines={1} />
      <CardSkeleton lines={1} />
    </div>
  );
}

export default async function HomePage() {
  const viewer = await requireViewerPage();
  const [profile] = await db.select({ lookingForCofounder: profiles.lookingForCofounder }).from(profiles).where(eq(profiles.userId, viewer.userId));
  const first = viewer.displayName.split(" ")[0];
  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <h1 className="text-[30px] leading-tight font-semibold tracking-tight sm:text-[40px]">
          {greeting(viewer.timezone)}, {first}.
        </h1>
        <p className="mt-2 text-[15px] text-muted sm:text-base">Here&apos;s who and what could move your startup forward today.</p>
        <Link
          href="/ai"
          className="mt-6 flex items-center gap-3 rounded-[16px] border border-border bg-card px-4 py-3.5 text-[15px] text-subtle shadow-soft transition-colors hover:border-border-strong sm:max-w-xl"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-gradient text-white">
            <Sparkles className="size-4" aria-hidden />
          </span>
          Tell You&amp;Me AI what you&apos;re working on…
        </Link>
      </header>

      <section aria-labelledby="matches-h">
        <SectionHeader
          title="Today's matches"
          description="Five people worth meeting."
          action={
            <Link href="/matches" className="text-sm font-medium text-brand-ink hover:underline" id="matches-h">
              See all
            </Link>
          }
        />
        <Suspense fallback={<SectionFallback />}>
          <TodaysMatches userId={viewer.userId} seeking={profile?.lookingForCofounder ?? false} />
        </Suspense>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <section>
            <SectionHeader
              title="Recommended consultants"
              description="Based on what your startup needs."
              action={
                <Link href="/consultants" className="text-sm font-medium text-brand-ink hover:underline">
                  Browse all
                </Link>
              }
            />
            <Suspense fallback={<SectionFallback />}>
              <RecommendedConsultants userId={viewer.userId} />
            </Suspense>
          </section>
          <Suspense fallback={<CardSkeleton lines={3} />}>
            <Gaps userId={viewer.userId} />
          </Suspense>
        </div>

        <aside className="space-y-10">
          <section>
            <SectionHeader title="Your startup" />
            <Suspense fallback={<CardSkeleton />}>
              <YourStartup userId={viewer.userId} />
            </Suspense>
          </section>
          <section>
            <SectionHeader
              title="Conversations"
              action={
                <Link href="/messages" className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
                  <MessageCircle className="size-3.5" aria-hidden /> Inbox
                </Link>
              }
            />
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              <Conversations userId={viewer.userId} />
            </Suspense>
          </section>
          <section>
            <SectionHeader title="Recommended actions" />
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <Actions userId={viewer.userId} />
            </Suspense>
          </section>
        </aside>
      </div>
    </div>
  );
}
