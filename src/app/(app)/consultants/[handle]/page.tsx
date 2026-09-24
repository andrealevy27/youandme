import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Building2, CalendarClock, Check, Clock, ExternalLink, Globe2, Languages, MapPin, Sparkles } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { getAvailabilityPreview, getConsultantProfileByHandle } from "@/server/consultants";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileActions } from "@/components/consultants/profile-actions";
import { RatingSummary, Stars } from "@/components/consultants/rating";
import { formatDuration, formatRating, formatServicePrice, formatSlotDay, formatSlotTime, localDayKey, pricingNote } from "@/components/consultants/format";
import { describeDimension, DIMENSION_KEYS, DIMENSIONS } from "@/lib/personality";
import { STAGE_LABELS, type StartupStage } from "@/lib/domain";
import { safeUrl } from "@/lib/utils";
import { messageConsultantAction, reportConsultantAction, saveConsultantAction } from "./actions";

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle} · Consultant` };
}

export default async function ConsultantProfilePage({ params }: { params: Params }) {
  const viewer = await requireViewerPage();
  const { handle } = await params;
  const view = await getConsultantProfileByHandle(viewer.userId, decodeURIComponent(handle));
  if (!view) notFound();
  const { card: c, services, aggregate, reviews, portfolio, personality, payment, isOwn, profile } = view;
  const preview = services.length ? await getAvailabilityPreview(c.userId, 6) : null;
  const firstService = services[0];
  const canBook = !isOwn && c.acceptingClients && payment.payable && profile.status === "approved";
  const bookHref = firstService ? `/consultants/${c.handle}/book/${firstService.id}` : null;
  const actions = { message: messageConsultantAction, save: saveConsultantAction, report: reportConsultantAction };

  return (
    <div className="animate-fade-up pb-20 lg:pb-0">
      {isOwn && profile.status !== "approved" && (
        <div className="mb-6 flex items-start gap-3 rounded-[14px] border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            This is a preview — only you can see it. Your consultant profile is <strong>{profile.status.replace("_", " ")}</strong>.{" "}
            <Link href="/consultant" className="underline underline-offset-2">
              Go to your workspace
            </Link>
          </p>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar name={c.name} src={c.avatarUrl} size="2xl" rounded="xl" className="shadow-soft" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight sm:text-[34px]">{c.name}</h1>
            {c.isDemo && <DemoBadge />}
          </div>
          <p className="mt-1.5 text-[16px] text-foreground/90 sm:text-[17px]">{c.headline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
            <RatingSummary avg={c.ratingAvg} count={c.reviewCount} />
            {c.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {c.location}
              </span>
            )}
            {c.languages.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Languages className="size-3.5" aria-hidden /> {c.languages.join(", ")}
              </span>
            )}
            {c.remoteAvailable && (
              <span className="inline-flex items-center gap-1">
                <Globe2 className="size-3.5" aria-hidden /> Works remotely
              </span>
            )}
            {c.yearsExperience ? <span>{c.yearsExperience}+ years experience</span> : null}
          </div>
          {!isOwn && (
            <div className="mt-5">
              <ProfileActions consultantId={c.userId} bookHref={bookHref} canBook={canBook} initiallySaved={view.isSaved} actions={actions} />
            </div>
          )}
          {!isOwn && !c.acceptingClients && <p className="mt-3 text-sm text-muted">{c.name.split(" ")[0]} isn&apos;t taking new clients right now — you can still send a message.</p>}
          {!isOwn && c.acceptingClients && !payment.payable && (
            <p className="mt-3 flex items-start gap-2 rounded-[12px] bg-surface p-3 text-[13px] text-muted">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {payment.reason}
            </p>
          )}
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-10">
          {(profile.bio || c.bio) && (
            <Section title="About">
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">{profile.bio ?? c.bio}</p>
            </Section>
          )}

          <Section title="Expertise">
            <div className="flex flex-col gap-4">
              {c.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.categories.map((cat) => (
                    <Link key={cat.slug} href={`/consultants?category=${cat.slug}`}>
                      <Badge variant="brand" size="md">
                        {cat.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
              <dl className="grid gap-4 sm:grid-cols-2">
                {c.stagesServed.length > 0 && (
                  <Fact label="Stages they work with">{c.stagesServed.map((s) => STAGE_LABELS[s as StartupStage] ?? s).join(", ")}</Fact>
                )}
                {c.industries.length > 0 && <Fact label="Industries">{c.industries.join(", ")}</Fact>}
                {c.previousCompanies.length > 0 && (
                  <Fact label="Previously at">
                    <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
                      {c.previousCompanies.map((co) => (
                        <span key={co} className="inline-flex items-center gap-1">
                          <Building2 className="size-3.5 text-muted" aria-hidden /> {co}
                        </span>
                      ))}
                    </span>
                  </Fact>
                )}
                {profile.engagementCount > 0 && <Fact label="Sessions on You&Me">{profile.engagementCount}</Fact>}
              </dl>
            </div>
          </Section>

          <Section title="Services" id="services">
            {services.length === 0 ? (
              <EmptyState title="No services listed yet" description="This consultant hasn't published any services. Send them a message to ask how they can help." />
            ) : (
              <ul className="flex flex-col gap-3">
                {services.map((s) => (
                  <li key={s.id}>
                    <Card className="p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-semibold">{s.title}</h3>
                          <p className="mt-1 text-sm text-muted">{s.description}</p>
                          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3.5" aria-hidden /> {formatDuration(s.durationMinutes)}
                              {s.pricingType === "package" || s.pricingType === "recurring" ? " kickoff call" : ""}
                            </span>
                            <span>{pricingNote(s.pricingType, s.billingInterval)}</span>
                          </p>
                          {s.includes.length > 0 && (
                            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                              {s.includes.map((inc) => (
                                <li key={inc} className="flex items-start gap-1.5 text-[13px]">
                                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden /> {inc}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                          <p className="text-lg font-semibold tabular-nums">{formatServicePrice(s.priceCents, s.currency, s.pricingType, s.billingInterval)}</p>
                          {canBook && (
                            <Button asChild size="sm" variant="secondary">
                              <Link href={`/consultants/${c.handle}/book/${s.id}`}>Book</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {portfolio.length > 0 && (
            <Section title="Portfolio">
              <ul className="grid gap-3 sm:grid-cols-2">
                {portfolio.map((p) => {
                  const url = safeUrl(p.url);
                  return (
                    <li key={p.id} className="rounded-[14px] border border-border bg-card p-4">
                      <h3 className="text-sm font-semibold">{p.title}</h3>
                      {p.description && <p className="mt-1 text-[13px] text-muted">{p.description}</p>}
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-[13px] text-brand-ink hover:underline">
                          View project <ExternalLink className="size-3" aria-hidden />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section title="Reviews" id="reviews">
            {aggregate.count === 0 ? (
              <EmptyState icon={<Sparkles />} title="No reviews yet" description={`${c.name.split(" ")[0]} is new to You&Me. Reviews appear here after completed sessions — only from clients who actually booked.`} />
            ) : (
              <div className="flex flex-col gap-6">
                <div className="grid gap-6 rounded-[16px] border border-border bg-card p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="text-center sm:pr-6 sm:text-left">
                    <p className="text-4xl font-semibold tabular-nums">{formatRating(aggregate.overall)}</p>
                    <Stars value={aggregate.overall ?? 0} className="mt-1" />
                    <p className="mt-1 text-[13px] text-muted">
                      {aggregate.count} verified review{aggregate.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <dl className="grid gap-2.5">
                    {(["expertise", "communication", "value", "reliability"] as const).map((k) => (
                      <div key={k} className="grid grid-cols-[110px_1fr_32px] items-center gap-3 text-[13px]">
                        <dt className="text-muted capitalize">{k}</dt>
                        <dd className="h-1.5 overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${((aggregate[k] ?? 0) / 5) * 100}%` }} />
                        </dd>
                        <dd className="text-right font-medium tabular-nums">{formatRating(aggregate[k])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <ul className="flex flex-col divide-y divide-border">
                  {reviews.map((r) => (
                    <li key={r.id} className="py-4 first:pt-0">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.reviewer.name} src={r.reviewer.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {r.reviewer.name} {r.reviewer.isDemo && <DemoBadge />}
                          </p>
                          <p className="text-xs text-muted">
                            {r.serviceTitle ? `${r.serviceTitle} · ` : ""}
                            {r.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <Stars value={r.overall} />
                      </div>
                      {r.body && <p className="mt-2 text-sm leading-relaxed text-foreground/90">{r.body}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <CalendarClock className="size-4 text-muted" aria-hidden /> Next available
              </h2>
              {!preview || !preview.hasRules ? (
                <p className="mt-2 text-sm text-muted">No availability published yet. Send a message to find a time.</p>
              ) : preview.slots.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Fully booked for the next three weeks. Send a message to ask about other times.</p>
              ) : (
                <>
                  <ul className="mt-3 flex flex-col gap-2">
                    {groupByDay(preview.slots.map((s) => s.startsAt), viewer.timezone).map(([day, times]) => (
                      <li key={day} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium">{formatSlotDay(times[0]!, viewer.timezone)}</span>
                        <span className="text-right text-muted tabular-nums">{times.map((t) => formatSlotTime(t, viewer.timezone)).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-subtle">Times in your timezone ({viewer.timezone.replace(/_/g, " ")}).</p>
                  {canBook && preview.serviceId && (
                    <Button asChild variant="secondary" size="sm" className="mt-4 w-full">
                      <Link href={`/consultants/${c.handle}/book/${preview.serviceId}`}>See all times</Link>
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {personality && (
            <Card>
              <CardContent>
                <h2 className="text-[15px] font-semibold">Working style</h2>
                <p className="mt-1 text-xs text-subtle">Self-reported via the You&amp;Me working-style quiz.</p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {DIMENSION_KEYS.filter((k) => typeof personality[k] === "number")
                    .slice(0, 5)
                    .map((k) => (
                      <li key={k} className="text-sm">
                        <span className="block text-xs text-muted">
                          {DIMENSIONS[k].left} ↔ {DIMENSIONS[k].right}
                        </span>
                        {describeDimension(k, personality[k]!)}
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="text-[13px] text-muted">
              <p className="font-medium text-foreground">How booking works</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Pick a service and a time that works.</li>
                <li>Add context and, optionally, teammates.</li>
                <li>Pay securely — the platform fee is shown up front.</li>
                <li>Chat with {c.name.split(" ")[0]} before and after the session.</li>
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>

      {!isOwn && <ProfileActions layout="sticky" consultantId={c.userId} bookHref={bookHref} canBook={canBook} initiallySaved={view.isSaved} actions={actions} />}
    </div>
  );
}

function groupByDay(dates: Date[], tz: string): [string, Date[]][] {
  const map = new Map<string, Date[]>();
  for (const d of dates) {
    const k = localDayKey(d, tz);
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  return [...map.entries()].slice(0, 3);
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-4 text-[17px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
