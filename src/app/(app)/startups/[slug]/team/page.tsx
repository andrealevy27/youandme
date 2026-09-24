import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { getStartupBySlug } from "@/server/startups";
import { canOnStartup } from "@/server/authz/startup";
import { TeamManager } from "@/components/startups/team-manager";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireViewerPage();
  const { slug } = await params;
  const data = await getStartupBySlug(viewer.userId, slug);
  if (!data || !data.membership) notFound();
  const s = data.startup;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/startups/${s.slug}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {s.name}
      </Link>
      <PageHeader title="Team" description="Founders and admins can invite people, change roles and manage bookings. Contractors and advisors see the team space but can't manage it." />
      <TeamManager
        startupId={s.id}
        slug={s.slug}
        viewerId={viewer.userId}
        canInvite={canOnStartup(data.membership, "invite_members")}
        canManage={canOnStartup(data.membership, "manage_settings")}
        canRemove={canOnStartup(data.membership, "remove_members")}
        members={data.members.map((m) => ({
          userId: m.userId,
          name: m.person.name,
          handle: m.person.handle,
          avatarUrl: m.person.avatarUrl,
          role: m.role,
          title: m.title,
          isAdmin: m.isAdmin,
        }))}
        invites={data.pendingInvites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))}
      />
    </div>
  );
}
