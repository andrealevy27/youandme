import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Briefcase, ExternalLink, GraduationCap, MapPin, ShieldCheck } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { findUserIdByHandle, getFullProfile, getProfileCompletion } from "@/server/people";
import { getCompatibility } from "@/server/matching";
import { getRelationship } from "@/server/matching/interests";
import { getConnectionState } from "@/server/connections";
import { db } from "@/server/db";
import { startupMembers } from "@/server/db/schema";
import { ProfileActions } from "@/components/people/profile-actions";
import { WorkingStyleBars } from "@/components/people/working-style";
import { CompatibilityBreakdown } from "@/components/matching/compatibility-breakdown";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AMBITION_LABELS,
  AVAILABILITY_LABELS,
  COFOUNDER_TYPE_LABELS,
  COMMITMENT_LABELS,
  FOUNDER_EXPERIENCE_LABELS,
  STAGE_LABELS,
  USER_ROLE_LABELS,
  VERIFICATION_LABELS,
  WORK_MODE_LABELS,
  type CofounderType,
  type StartupStage,
  type UserRole,
} from "@/lib/domain";
import type { DimensionKey } from "@/lib/personality";
import { safeUrl } from "@/lib/utils";
import { getWorkingStyle } from "@/server/personality";
import { listMyStartups } from "@/server/startups";
import { isSaved } from "@/server/saved";
import { hasBlocked } from "@/server/moderation";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 text-[15px] font-semibold tracking-tight">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function PersonPage({ params }: Props) {
  const viewer = await requireViewerPage();
  const { handle } = await params;
  const targetId = await findUserIdByHandle(handle);
  if (!targetId) notFound();
  const full = await getFullProfile(viewer.userId, targetId);
  if (!full) notFound();
  const isSelf = viewer.userId === targetId;
  const { profile: p, summary } = full;

  const [compat, relationship, connection, completion, myStyle, viewerAdminStartups] = await Promise.all([
    isSelf ? null : getCompatibility(viewer.userId, targetId),
    isSelf ? null : getRelationship(viewer.userId, targetId),
    isSelf ? null : getConnectionState(viewer.userId, targetId),
    isSelf ? getProfileCompletion(viewer.userId) : null,
    isSelf ? null : getWorkingStyle(viewer.userId),
    isSelf ? [] : listMyStartups(viewer.userId).then((rows) => rows.filter((r) => r.isAdmin || r.role === "founder").map((r) => ({ startupId: r.startup.id, name: r.startup.name }))),
  ]);

  const [saved, blocked] = isSelf
    ? [false, false]
    : await Promise.all([isSaved(viewer.userId, full.consultant ? "consultant" : "user", targetId), hasBlocked(viewer.userId, targetId)]);
  const teammateIds = viewerAdminStartups.length
    ? await db
        .select({ startupId: startupMembers.startupId })
        .from(startupMembers)
        .where(and(eq(startupMembers.userId, targetId), inArray(startupMembers.startupId, viewerAdminStartups.map((s) => s.startupId)), isNull(startupMembers.removedAt)))
    : [];

  const links = [
    { label: "LinkedIn", url: safeUrl(p.linkedinUrl) },
    { label: "Website", url: safeUrl(p.websiteUrl) },
    { label: "GitHub", url: safeUrl(p.githubUrl) },
    { label: "Portfolio", url: safeUrl(p.portfolioUrl) },
  ].filter((l): l is { label: string; url: string } => !!l.url);

  const scores = full.personality?.scores as Partial<Record<DimensionKey, number>> | undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-brand-gradient opacity-90 sm:h-32" aria-hidden />
        <CardContent>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={p.displayName} src={p.avatarUrl} size="2xl" rounded="xl" className="-mt-20 shrink-0 ring-4 ring-card sm:-mt-16" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{p.displayName}</h1>
                  {summary.verified.length > 0 && (
                    <span title={summary.verified.map((v) => VERIFICATION_LABELS[v as keyof typeof VERIFICATION_LABELS]).join(" · ")}>
                      <ShieldCheck className="size-5 text-brand" aria-label={`Verified: ${summary.verified.map((v) => VERIFICATION_LABELS[v as keyof typeof VERIFICATION_LABELS]).join(", ")}`} />
                    </span>
                  )}
                  {p.isDemo && <DemoBadge />}
                </div>
                {p.headline && <p className="mt-1 text-[15px] text-muted">{p.headline}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                  {(p.currentRole || p.currentCompany) && (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="size-3.5" aria-hidden />
                      {[p.currentRole, p.currentCompany].filter(Boolean).join(" at ")}
                    </span>
                  )}
                  {summary.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden />
                      {summary.location}
                    </span>
                  )}
                  {p.university && (
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="size-3.5" aria-hidden />
                      {p.university}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {isSelf ? (
              <div className="flex gap-2">
                <Button variant="secondary" asChild>
                  <Link href="/working-style">Working style</Link>
                </Button>
                <Button asChild>
                  <Link href="/profile/edit">Edit profile</Link>
                </Button>
              </div>
            ) : (
              <ProfileActions
                targetId={targetId}
                name={p.displayName}
                isConsultant={!!full.consultant}
                handle={p.handle}
                lookingForCofounder={p.lookingForCofounder}
                myInterest={relationship?.myInterest ?? null}
                matchConversationId={relationship?.match?.conversationId ?? null}
                connection={connection?.state ?? "none"}
                connectionId={connection?.id ?? null}
                saved={saved}
                blocked={blocked}
                inviteStartups={viewerAdminStartups
                  .filter((s) => !teammateIds.some((t) => t.startupId === s.startupId))
                  .map((s) => ({ id: s.startupId, name: s.name }))}
              />
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {summary.roles.map((r) => (
              <Badge key={r} variant="outline">
                {USER_ROLE_LABELS[r as UserRole] ?? r}
              </Badge>
            ))}
            {p.lookingForCofounder && <Badge variant="brand">Looking for a cofounder</Badge>}
          </div>
        </CardContent>
      </Card>

      {isSelf && completion && completion.percent < 100 && (
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="sm:w-56">
              <p className="text-sm font-medium">{completion.percent}% complete</p>
              <Progress value={completion.percent} className="mt-2" label="Profile completion" />
            </div>
            <ul className="flex flex-1 flex-wrap gap-2">
              {completion.missing.slice(0, 4).map((m) => (
                <li key={m.key}>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={m.href}>{m.label}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {compat && (
            <Section title="Your compatibility">
              <CompatibilityBreakdown result={compat} />
            </Section>
          )}
          {(p.bio || p.lookingFor) && (
            <Section title="About">
              {p.bio && <p className="text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">{p.bio}</p>}
              {p.lookingFor && (
                <div className="mt-5 rounded-[12px] bg-surface px-4 py-3">
                  <p className="text-xs font-medium tracking-wide text-subtle uppercase">What I&apos;m looking for</p>
                  <p className="mt-1 text-sm">{p.lookingFor}</p>
                </div>
              )}
            </Section>
          )}
          {full.skills.length > 0 && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-2">
                {full.skills
                  .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
                  .map((s) => (
                    <Badge key={s.id} size="md" variant={s.isPrimary ? "brand" : "neutral"}>
                      {s.name}
                    </Badge>
                  ))}
              </div>
            </Section>
          )}
          {full.experiences.length > 0 && (
            <Section title="Experience">
              <ol className="space-y-5">
                {full.experiences.map((e) => (
                  <li key={e.id} className="flex gap-4">
                    <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-muted">
                      <Briefcase className="size-4" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-sm text-muted">{e.company}</p>
                      <p className="text-xs text-subtle">
                        {e.startYear ?? ""}
                        {e.startYear ? " – " : ""}
                        {e.isCurrent ? "Present" : (e.endYear ?? "")}
                      </p>
                      {e.description && <p className="mt-1.5 text-sm text-muted">{e.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}
          {full.educations.length > 0 && (
            <Section title="Education">
              <ul className="space-y-3">
                {full.educations.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-medium">{e.school}</span>
                    {(e.degree || e.field) && <span className="text-muted"> · {[e.degree, e.field].filter(Boolean).join(", ")}</span>}
                    {e.endYear && <span className="text-subtle"> · {e.endYear}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {scores && (
            <Section title="Working style">
              <WorkingStyleBars
                scores={scores}
                compare={!isSelf ? ((myStyle?.scores as Partial<Record<DimensionKey, number>>) ?? null) : null}
                compareLabel={p.displayName.split(" ")[0]}
              />
              <p className="mt-4 text-xs text-subtle">Self-described working style — not a clinical assessment.</p>
            </Section>
          )}
        </div>

        <aside className="space-y-5">
          <Section title="Startup interests">
            <dl className="grid grid-cols-2 gap-4">
              {p.commitment && <Fact label="Commitment" value={COMMITMENT_LABELS[p.commitment]} />}
              {p.availability && <Fact label="Availability" value={AVAILABILITY_LABELS[p.availability]} />}
              {p.workMode && <Fact label="Works" value={WORK_MODE_LABELS[p.workMode]} />}
              {p.ambition && <Fact label="Ambition" value={AMBITION_LABELS[p.ambition]} />}
              {p.founderExperience && <Fact label="Experience" value={FOUNDER_EXPERIENCE_LABELS[p.founderExperience]} />}
              {p.yearsExperience !== null && <Fact label="Years working" value={p.yearsExperience} />}
            </dl>
            {p.cofounderTypes.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs text-subtle">Looking for</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.cofounderTypes.map((t) => (
                    <Badge key={t} variant="brand">
                      {COFOUNDER_TYPE_LABELS[t as CofounderType]} cofounder
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {summary.industries.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs text-subtle">Industries</p>
                <div className="flex flex-wrap gap-1.5">
                  {summary.industries.map((i) => (
                    <Badge key={i}>{i}</Badge>
                  ))}
                </div>
              </div>
            )}
            {p.stagePreferences.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs text-subtle">Stages</p>
                <p className="text-sm">{p.stagePreferences.map((s) => STAGE_LABELS[s as StartupStage]).join(" · ")}</p>
              </div>
            )}
            {p.equityExpectation && (
              <div className="mt-5">
                <p className="mb-1 text-xs text-subtle">Equity expectations</p>
                <p className="text-sm">{p.equityExpectation}</p>
              </div>
            )}
          </Section>

          {full.startups.length > 0 && (
            <Section title="Startup">
              <ul className="space-y-3">
                {full.startups.map(({ startup, title, role }) => (
                  <li key={startup.id}>
                    <Link href={`/startups/${startup.slug}`} className="group flex items-center gap-3">
                      <Avatar name={startup.name} src={startup.logoUrl} size="md" rounded="xl" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium group-hover:underline">{startup.name}</p>
                        <p className="truncate text-xs text-muted">
                          {title ?? role} · {STAGE_LABELS[startup.stage]}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {full.consultant && (
            <Section title="Consulting">
              <p className="text-sm text-muted">{full.consultant.headline}</p>
              <Button className="mt-4 w-full" variant="soft" asChild>
                <Link href={`/consultants/${p.handle}`}>{isSelf ? "View consultant profile" : "Book a consultation"}</Link>
              </Button>
            </Section>
          )}

          {links.length > 0 && (
            <Section title="Links">
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l.label}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 text-sm hover:underline">
                      <ExternalLink className="size-3.5 text-subtle" aria-hidden />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {summary.verified.length > 0 && (
            <Section title="Verification">
              <ul className="space-y-2">
                {summary.verified.map((v) => (
                  <li key={v} className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="size-4 text-brand" aria-hidden />
                    {VERIFICATION_LABELS[v as keyof typeof VERIFICATION_LABELS]}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-subtle">Badges only show what was actually checked.</p>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}
