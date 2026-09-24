import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Rocket } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { listMyInvites, listMyStartups } from "@/server/startups";
import { InviteResponse } from "@/components/startups/invite-response";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { STAGE_LABELS, STARTUP_MEMBER_ROLE_LABELS } from "@/lib/domain";

export const metadata: Metadata = { title: "Your startups" };

export default async function StartupHubPage() {
  const viewer = await requireViewerPage();
  const [mine, invites] = await Promise.all([listMyStartups(viewer.userId), listMyInvites(viewer.userId, viewer.email)]);
  return (
    <>
      <PageHeader
        eyebrow="Startup"
        title="Build the team behind the idea."
        description="Your startup's home on You&Me: profile, team, needs and open roles."
        actions={
          <Button asChild>
            <Link href="/startups/new">
              <Plus /> New startup
            </Link>
          </Button>
        }
      />
      {invites.length > 0 && (
        <div className="mb-6 space-y-3">
          {invites.map(({ invite, startup }) => (
            <Card key={invite.id} className="border-brand/30">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar name={startup.name} src={startup.logoUrl} size="md" rounded="xl" />
                <p className="flex-1 text-sm">
                  You&apos;re invited to join <span className="font-medium">{startup.name}</span> as {STARTUP_MEMBER_ROLE_LABELS[invite.role].toLowerCase()}.
                </p>
                <InviteResponse token={invite.token} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {mine.length === 0 ? (
        <EmptyState
          icon={<Rocket />}
          title="No startup yet"
          description="Create a startup profile to attract cofounders, early employees and the right consultants. An idea is enough to start."
          action={
            <Button asChild>
              <Link href="/startups/new">Create your startup</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {mine.map(({ startup, role, title }) => (
            <li key={startup.id}>
              <Link href={`/startups/${startup.slug}`} className="block rounded-[16px] border border-border bg-card p-5 shadow-soft transition-colors hover:border-border-strong">
                <div className="flex items-center gap-3">
                  <Avatar name={startup.name} src={startup.logoUrl} size="lg" rounded="xl" />
                  <div className="min-w-0">
                    <p className="font-semibold">{startup.name}</p>
                    <p className="text-sm text-muted">{title ?? STARTUP_MEMBER_ROLE_LABELS[role]}</p>
                  </div>
                </div>
                {startup.tagline && <p className="mt-4 line-clamp-2 text-sm text-muted">{startup.tagline}</p>}
                <div className="mt-4 flex gap-1.5">
                  <Badge variant="brand">{STAGE_LABELS[startup.stage]}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
