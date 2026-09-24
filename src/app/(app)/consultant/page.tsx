import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Brain, CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { features } from "@/server/env";
import { getApplicationDefaults, getConsultantWorkspace, listActiveCategories } from "@/server/consultants";
import { getConsultantBookingSummary, listBookingsForUser } from "@/server/bookings";
import { getPayoutStatus } from "@/server/payments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ConsultantProfileForm, type ProfileFormValues } from "@/components/consultants/workspace/profile-form";
import { ServicesManager } from "@/components/consultants/workspace/services-manager";
import { AvailabilityEditor, SchedulingSettings, TimeOffManager } from "@/components/consultants/workspace/availability-editor";
import { PortfolioManager } from "@/components/consultants/workspace/portfolio-manager";
import { PayoutsPanel } from "@/components/consultants/workspace/payouts-card";
import { formatDateTimeRange } from "@/components/consultants/format";
import { formatMoney } from "@/lib/utils";
import type { StartupStage } from "@/lib/domain";
import {
  addPortfolioAction,
  addTimeOffAction,
  applyAsConsultantAction,
  connectPayoutsAction,
  payoutDashboardAction,
  refreshPayoutStatusAction,
  removePortfolioAction,
  removeTimeOffAction,
  setAvailabilityAction,
  setServiceActiveAction,
  updateConsultantProfileAction,
  updateSchedulingAction,
  upsertServiceAction,
} from "./actions";

export const metadata: Metadata = { title: "Consultant workspace" };

function timezoneList(current: string) {
  let list: string[] = [];
  try {
    list = Intl.supportedValuesOf("timeZone");
  } catch {
    list = ["UTC"];
  }
  return list.includes(current) ? list : [current, ...list];
}

export default async function ConsultantWorkspacePage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const viewer = await requireViewerPage();
  const { stripe } = await searchParams;
  const [workspace, categories] = await Promise.all([getConsultantWorkspace(viewer.userId), listActiveCategories()]);
  const categoryOptions = categories.map(({ slug, name }) => ({ slug, name }));

  if (!workspace) {
    const defaults = await getApplicationDefaults(viewer.userId);
    const initial: ProfileFormValues = {
      headline: defaults?.headline ?? "",
      bio: defaults?.bio ?? "",
      yearsExperience: defaults?.yearsExperience ?? null,
      hourlyRateCents: null,
      languages: ["English"],
      previousCompanies: [],
      stagesServed: [],
      categorySlugs: [],
      remoteAvailable: true,
      acceptingClients: true,
    };
    return (
      <div className="animate-fade-up">
        <PageHeader eyebrow="Consultant workspace" title="Offer your expertise to founders" description="Set up a consultant profile, publish services and get booked by startups that need exactly what you know." />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <CardContent>
              <h2 className="mb-5 text-[17px] font-semibold tracking-tight">Your consultant profile</h2>
              <ConsultantProfileForm initial={initial} categories={categoryOptions} submitLabel="Submit for review" successMessage="Application submitted — we'll review it shortly." onSubmit={applyAsConsultantAction} />
            </CardContent>
          </Card>
          <aside className="flex flex-col gap-4 text-sm">
            <Card>
              <CardContent>
                <p className="font-medium">How it works</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted">
                  <li>Tell founders what you help with.</li>
                  <li>The You&amp;Me team reviews every consultant before they&apos;re listed.</li>
                  <li>Add services, weekly hours and payouts.</li>
                  <li>Get booked — with context up front and a chat for every session.</li>
                </ol>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    );
  }

  const { profile, services, rules, timeOff, portfolio } = workspace;
  const [summary, payout, upcoming] = await Promise.all([
    getConsultantBookingSummary(viewer.userId),
    getPayoutStatus(viewer.userId, { refresh: stripe === "return" }),
    listBookingsForUser(viewer.userId, "upcoming", { role: "consultant", limit: 5 }),
  ]);
  const hasQuiz = workspace.hasWorkingStyle;
  const catSlugBy = new Map(categories.map((c) => [c.id, c.slug]));
  const profileInitial: ProfileFormValues = {
    headline: profile.headline,
    bio: profile.bio ?? "",
    yearsExperience: profile.yearsExperience,
    hourlyRateCents: profile.hourlyRateCents,
    languages: profile.languages,
    previousCompanies: profile.previousCompanies,
    stagesServed: profile.stagesServed as StartupStage[],
    categorySlugs: workspace.categories.map((c) => c.slug),
    remoteAvailable: profile.remoteAvailable,
    acceptingClients: profile.acceptingClients,
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Consultant workspace"
        title="Your consulting practice"
        description="Profile, services, availability and payouts — everything founders see before they book you."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/consultants/${viewer.handle}`}>
              View public profile <ArrowUpRight />
            </Link>
          </Button>
        }
      />

      <StatusBanner status={profile.status} />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Upcoming sessions" value={String(summary.upcoming)} />
        <Stat label="To mark complete" value={String(summary.toComplete)} />
        <Stat label="Completed" value={String(summary.completed)} />
        <Stat label="Earned (after fees)" value={formatMoney(summary.earnedCents)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card id="profile">
            <CardContent>
              <h2 className="mb-5 text-[17px] font-semibold tracking-tight">Profile</h2>
              <ConsultantProfileForm initial={profileInitial} categories={categoryOptions} submitLabel="Save profile" successMessage="Profile saved" onSubmit={updateConsultantProfileAction} />
            </CardContent>
          </Card>

          <Card id="services">
            <CardContent>
              <h2 className="text-[17px] font-semibold tracking-tight">Services</h2>
              <p className="mt-1 mb-5 text-sm text-muted">Fixed sessions, hourly help, packages or monthly retainers.</p>
              <ServicesManager
                services={services.map((s) => ({
                  id: s.id,
                  title: s.title,
                  description: s.description,
                  pricingType: s.pricingType,
                  priceCents: s.priceCents,
                  currency: s.currency,
                  durationMinutes: s.durationMinutes,
                  billingInterval: s.billingInterval,
                  includes: s.includes,
                  categorySlug: s.categoryId ? (catSlugBy.get(s.categoryId) ?? null) : null,
                  active: s.active,
                }))}
                categories={categoryOptions}
                upsert={upsertServiceAction}
                setActive={setServiceActiveAction}
              />
            </CardContent>
          </Card>

          <Card id="availability">
            <CardContent className="flex flex-col gap-6">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight">Availability</h2>
                <p className="mt-1 text-sm text-muted">Founders only see times inside these hours, minus days off and existing bookings.</p>
              </div>
              <SchedulingSettings timezone={profile.timezone} minNoticeHours={profile.minNoticeHours} timezones={timezoneList(profile.timezone)} save={updateSchedulingAction} />
              <AvailabilityEditor initial={rules.map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute }))} save={setAvailabilityAction} />
              <div>
                <h3 className="mb-2 text-sm font-semibold">Days off</h3>
                <TimeOffManager items={timeOff.map((t) => ({ id: t.id, day: t.day }))} add={addTimeOffAction} remove={removeTimeOffAction} />
              </div>
              <p className="flex items-center gap-2 text-[13px] text-muted">
                Calendar sync (Google Calendar) <Badge>Coming soon</Badge>
              </p>
            </CardContent>
          </Card>

          <Card id="portfolio">
            <CardContent>
              <h2 className="mb-5 text-[17px] font-semibold tracking-tight">Portfolio</h2>
              <PortfolioManager items={portfolio.map((p) => ({ id: p.id, title: p.title, description: p.description, url: p.url }))} add={addPortfolioAction} remove={removePortfolioAction} />
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card id="payouts">
            <CardContent>
              <h2 className="mb-3 text-[15px] font-semibold">Payouts</h2>
              <PayoutsPanel status={payout} devPayments={features.devPayments} connect={connectPayoutsAction} dashboard={payoutDashboardAction} refresh={refreshPayoutStatusAction} />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Upcoming bookings</h2>
                <Link href="/bookings" className="text-[13px] text-brand-ink hover:underline">
                  All
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted">No upcoming sessions yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {upcoming.map((b) => {
                    const when = formatDateTimeRange(b.startsAt, b.endsAt, viewer.timezone);
                    return (
                      <li key={b.id}>
                        <Link href={`/bookings/${b.id}`} className="block rounded-[12px] p-2 -m-2 hover:bg-surface">
                          <p className="truncate text-sm font-medium">{b.serviceTitle}</p>
                          <p className="text-xs text-muted">
                            {b.counterpart.name} · {when.day.split(",").slice(0, 2).join(",")} · {when.time}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Brain className="size-4 text-muted" aria-hidden /> Working style
              </h2>
              <p className="mt-1 text-sm text-muted">
                {hasQuiz ? "Your working style is shown on your profile so founders know how you like to work." : "Founders like knowing how you work. Take the 3-minute quiz — it's shown on your profile."}
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-3">
                <Link href="/quiz">{hasQuiz ? "Retake quiz" : "Take the quiz"}</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function StatusBanner({ status }: { status: string }) {
  const map: Record<string, { tone: string; icon: React.ReactNode; title: string; body: string }> = {
    draft: { tone: "border-border bg-surface", icon: <Clock />, title: "Draft", body: "Save your profile to submit it for review." },
    pending_review: { tone: "border-warning/30 bg-warning-soft text-warning", icon: <Clock />, title: "In review", body: "The You&Me team is reviewing your profile. You'll get a notification when you're listed — keep setting up services and hours meanwhile." },
    approved: { tone: "border-success/30 bg-success-soft text-success", icon: <CheckCircle2 />, title: "Listed", body: "Your profile is live in the marketplace." },
    rejected: { tone: "border-danger/30 bg-danger-soft text-danger", icon: <XCircle />, title: "Not approved yet", body: "Update your profile with more detail and save it to resubmit for review." },
    suspended: { tone: "border-danger/30 bg-danger-soft text-danger", icon: <AlertCircle />, title: "Suspended", body: "Your consultant profile is hidden. Contact support for details." },
  };
  const s = map[status] ?? map.draft!;
  return (
    <div role="status" className={`mb-6 flex items-start gap-3 rounded-[14px] border p-4 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 ${s.tone}`}>
      {s.icon}
      <p>
        <strong>{s.title}.</strong> {s.body}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
