import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ClipboardList, Moon, Users } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { getDailyRecommendations } from "@/server/recommendations";
import { db } from "@/server/db";
import { personalityProfiles, profiles, userSkills } from "@/server/db/schema";
import { RecommendationCard } from "@/components/matching/recommendation-card";
import { MatchesTabs } from "@/components/matching/matches-tabs";
import { EnableCofounderMatching } from "@/components/matching/enable-matching";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Today's matches" };

export default async function MatchesPage() {
  const viewer = await requireViewerPage();
  const [[profile], skillRows, [quiz]] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, viewer.userId)),
    db.select({ id: userSkills.skillId }).from(userSkills).where(eq(userSkills.userId, viewer.userId)).limit(1),
    db.select({ id: personalityProfiles.userId }).from(personalityProfiles).where(eq(personalityProfiles.userId, viewer.userId)),
  ]);
  const seeking = profile?.lookingForCofounder ?? false;
  const header = (
    <PageHeader
      eyebrow="Cofounder matching"
      title="Five people worth meeting."
      description="Chosen for how well you'd build together — not how many profiles we can show you. New picks every morning."
    />
  );

  if (!seeking) {
    return (
      <>
        {header}
        <MatchesTabs active="today" />
        <EmptyState
          icon={<Users />}
          title="Cofounder matching is off"
          description="Turn it on and we'll introduce you to up to five complementary people each day. You can switch it off anytime."
          action={<EnableCofounderMatching />}
        />
      </>
    );
  }
  if (!skillRows.length) {
    return (
      <>
        {header}
        <MatchesTabs active="today" />
        <EmptyState
          icon={<Users />}
          title="No matches yet"
          description="Complete your profile so we can start finding founders who complement you. Skills and what you're missing matter most."
          action={
            <Button asChild>
              <Link href="/profile/edit#skills">Add your skills</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { items } = await getDailyRecommendations(viewer.userId);
  const remaining = items.filter((i) => i.action === "none").length;

  return (
    <>
      {header}
      <MatchesTabs active="today" />
      {!quiz && (
        <div className="mb-6 flex flex-col gap-3 rounded-[16px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <ClipboardList className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">Sharpen these matches.</span>{" "}
              <span className="text-muted">The working-style quiz lets us explain where you&apos;ll align and where you might clash.</span>
            </p>
          </div>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/quiz">Take the quiz</Link>
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState
          icon={<Moon />}
          title="No new people today"
          description="We only recommend people who genuinely fit. As more founders join, you'll see new picks here — meanwhile, tell You&Me AI exactly who you're looking for."
          action={
            <Button asChild>
              <Link href="/ai">Ask You&amp;Me AI</Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted" aria-live="polite">
            {remaining > 0 ? `${remaining} of ${items.length} left to review today` : "You've reviewed everyone for today. New picks arrive tomorrow."}
          </p>
          <div className="space-y-5">
            {items.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
