import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Briefcase, ExternalLink, FileText, Globe, MapPin, Pencil, Users } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { getStartupBySlug } from "@/server/startups";
import { canOnStartup } from "@/server/authz/startup";
import { db } from "@/server/db";
import { consultantCategories, skills } from "@/server/db/schema";
import { NeedsManager } from "@/components/startups/needs-manager";
import { OpenRolesManager } from "@/components/startups/open-roles";
import { TeamChatButton } from "@/components/startups/team-chat-button";
import { SaveButton } from "@/components/saved/save-button";
import { isSaved } from "@/server/saved";
import { TeamGapsCard } from "@/components/ai/team-gaps-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BUSINESS_MODEL_LABELS,
  FUNDING_STATUS_LABELS,
  STAGE_LABELS,
  STARTUP_MEMBER_ROLE_LABELS,
  WORK_MODE_LABELS,
  type BUSINESS_MODELS,
} from "@/lib/domain";
import { formatMoney, safeUrl } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

function Block({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default async function StartupPage({ params }: Props) {
  const viewer = await requireViewerPage();
  const { slug } = await params;
  const data = await getStartupBySlug(viewer.userId, slug);
  if (!data) notFound();
  const { startup: s, membership, members } = data;
  const canEdit = canOnStartup(membership, "edit");
  const canManageNeeds = canOnStartup(membership, "manage_needs");
  const [categoryRows, skillRows] = canManageNeeds
    ? await Promise.all([
        db.select({ id: consultantCategories.id, name: consultantCategories.name }).from(consultantCategories).where(eq(consultantCategories.active, true)).orderBy(asc(consultantCategories.sortOrder)),
        db.select({ id: skills.id, name: skills.name }).from(skills).orderBy(asc(skills.name)),
      ])
    : [[], []];
  const saved = membership ? false : await isSaved(viewer.userId, "startup", s.id);
  const founders = members.filter((m) => m.role === "founder" || m.role === "cofounder");
  const website = safeUrl(s.websiteUrl);
  const deck = safeUrl(s.pitchDeckUrl);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <Avatar name={s.name} src={s.logoUrl} size="xl" rounded="xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{s.name}</h1>
                  {s.isDemo && <DemoBadge />}
                  {s.status !== "active" && <Badge>{s.status.replace("_", " ")}</Badge>}
                </div>
                {s.tagline && <p className="mt-1 text-[15px] text-muted">{s.tagline}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="brand">{STAGE_LABELS[s.stage]}</Badge>
                  {data.industries.map((i) => (
                    <Badge key={i.id}>{i.name}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                  {s.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden /> {s.location}
                      {s.workMode ? ` · ${WORK_MODE_LABELS[s.workMode]}` : ""}
                    </span>
                  )}
                  {website && (
                    <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 hover:underline">
                      <Globe className="size-3.5" aria-hidden /> {new URL(website).hostname.replace(/^www\./, "")}
                    </a>
                  )}
                  {deck && membership && (
                    <a href={deck} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 hover:underline">
                      <FileText className="size-3.5" aria-hidden /> Pitch deck
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {membership ? (
                <>
                  <TeamChatButton startupId={s.id} />
                  <Button variant="secondary" asChild>
                    <Link href={`/startups/${s.slug}/team`}>
                      <Users /> Team
                    </Link>
                  </Button>
                  {canEdit && (
                    <Button asChild>
                      <Link href={`/startups/${s.slug}/edit`}>
                        <Pencil /> Edit
                      </Link>
                    </Button>
                  )}
                </>
              ) : (
                <SaveButton targetType="startup" targetId={s.id} initialSaved={saved} />
              )}
            </div>
          </div>
          {founders.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-5">
              {founders.map((m) => (
                <Link key={m.userId} href={`/people/${m.person.handle}`} className="group flex items-center gap-2.5">
                  <Avatar name={m.person.name} src={m.person.avatarUrl} size="sm" />
                  <span className="text-sm">
                    <span className="font-medium group-hover:underline">{m.person.name}</span>
                    <span className="block text-xs text-muted">{m.title ?? STARTUP_MEMBER_ROLE_LABELS[m.role]}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {(s.description || s.problem || s.solution) && (
            <Block title="About">
              {s.description && <p className="text-[15px] leading-relaxed whitespace-pre-line">{s.description}</p>}
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {s.problem && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-subtle uppercase">Problem</p>
                    <p className="text-sm leading-relaxed text-muted">{s.problem}</p>
                  </div>
                )}
                {s.solution && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-subtle uppercase">Solution</p>
                    <p className="text-sm leading-relaxed text-muted">{s.solution}</p>
                  </div>
                )}
              </div>
            </Block>
          )}
          {s.traction && (
            <Block title="Traction">
              <p className="text-sm leading-relaxed whitespace-pre-line">{s.traction}</p>
            </Block>
          )}
          <Block title="What we're looking for">
            <NeedsManager
              needs={data.needs.map((n) => ({ ...n, category: n.category ? { id: n.category.id, name: n.category.name, slug: n.category.slug } : null }))}
              canManage={canManageNeeds}
              startupId={s.id}
              slug={s.slug}
              categories={categoryRows}
              skills={skillRows}
            />
          </Block>
          <Block title="Open roles">
            <OpenRolesManager roles={data.openRoles} canManage={canManageNeeds} startupId={s.id} slug={s.slug} founderHandle={founders[0]?.person.handle ?? null} />
          </Block>
          {membership && <TeamGapsCard viewerId={viewer.userId} startupId={s.id} />}
        </div>
        <aside className="space-y-5">
          <Block title="At a glance">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-subtle">Stage</dt>
                <dd className="mt-0.5 font-medium">{STAGE_LABELS[s.stage]}</dd>
              </div>
              {s.businessModel && (
                <div>
                  <dt className="text-xs text-subtle">Model</dt>
                  <dd className="mt-0.5 font-medium">{BUSINESS_MODEL_LABELS[s.businessModel as (typeof BUSINESS_MODELS)[number]] ?? s.businessModel}</dd>
                </div>
              )}
              {s.fundingStatus && (
                <div>
                  <dt className="text-xs text-subtle">Funding</dt>
                  <dd className="mt-0.5 font-medium">{FUNDING_STATUS_LABELS[s.fundingStatus]}</dd>
                </div>
              )}
              {s.fundingRaisedCents ? (
                <div>
                  <dt className="text-xs text-subtle">Raised</dt>
                  <dd className="mt-0.5 font-medium">{formatMoney(s.fundingRaisedCents)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-subtle">Team</dt>
                <dd className="mt-0.5 font-medium">{members.length} on You&amp;Me</dd>
              </div>
              {s.foundedOn && (
                <div>
                  <dt className="text-xs text-subtle">Founded</dt>
                  <dd className="mt-0.5 font-medium">{new Date(s.foundedOn).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</dd>
                </div>
              )}
            </dl>
          </Block>
          <Block title="Team" action={membership ? <Link href={`/startups/${s.slug}/team`} className="text-sm text-brand-ink hover:underline">Manage</Link> : undefined}>
            <ul className="space-y-3">
              {members.map((m) => (
                <li key={m.userId}>
                  <Link href={`/people/${m.person.handle}`} className="group flex items-center gap-3">
                    <Avatar name={m.person.name} src={m.person.avatarUrl} size="sm" />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-medium group-hover:underline">{m.person.name}</span>
                      <span className="block truncate text-xs text-muted">{m.title ?? STARTUP_MEMBER_ROLE_LABELS[m.role]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Block>
          {membership && (
            <Card className="bg-brand-soft/50">
              <CardContent>
                <Briefcase className="mb-3 size-5 text-brand-ink" aria-hidden />
                <p className="text-sm font-medium">Bring in expertise</p>
                <p className="mt-1 text-sm text-muted">Book a consultant and invite your team into the session.</p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/consultants">Browse consultants</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-center gap-2 text-sm text-muted hover:text-foreground">
              Visit website <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
