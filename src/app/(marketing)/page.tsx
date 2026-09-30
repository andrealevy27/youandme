import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Briefcase,
  Calendar,
  Check,
  Compass,
  Gauge,
  Lightbulb,
  Megaphone,
  Palette,
  Rocket,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMarketingContext } from "@/components/marketing/context";
import { HeroMockup, MockAvatar, MockRing } from "@/components/marketing/hero-mockup";
import { Eyebrow, Lead, Section, SectionTitle } from "@/components/marketing/section";
import s from "@/components/marketing/marketing.module.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "You&Me — Build the team behind your startup" },
  description:
    "The network for building startups. Find cofounders, consultants, advisors, and startup talent — intelligently matched to what you're building.",
  openGraph: {
    title: "You&Me — Build the team behind your startup",
    description: "Find cofounders, consultants, advisors, and startup talent — intelligently matched to what you're building.",
    siteName: "You&Me",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "You&Me — Build the team behind your startup" },
  alternates: { canonical: "/" },
};

export default async function LandingPage() {
  const { signedIn, showWaitlist, primaryCta: primary } = await getMarketingContext();

  return (
    <>
      <Hero primary={primary} signedIn={signedIn} />
      <HowItWorks />
      <Cofounders />
      <Consultants />
      <AI />
      <Startups />
      <Stages />
      <FinalCta primary={primary} showWaitlist={showWaitlist && !signedIn && primary.href !== "/waitlist"} />
    </>
  );
}

/* ───────────────────────────── Hero ───────────────────────────── */

function Hero({ primary, signedIn }: { primary: { href: string; label: string }; signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden px-5 pt-14 pb-20 sm:px-8 sm:pt-20 lg:pt-24 lg:pb-32">
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10", s.grid)} />
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10", s.glow)} />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className={cn("inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[13px] text-muted", s.rise)}>
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            The network for building startups
          </p>
          <h1
            className={cn(
              "mt-6 text-[44px] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-[64px] lg:text-[76px]",
              s.rise,
            )}
            style={{ animationDelay: "80ms" }}
          >
            Build the team behind <span className="text-gradient">your startup.</span>
          </h1>
          <p className={cn("mt-6 max-w-[34rem] text-[18px] leading-relaxed text-pretty text-muted sm:text-[20px]", s.rise)} style={{ animationDelay: "160ms" }}>
            Find cofounders, consultants, advisors, and startup talent — intelligently matched to what you&apos;re building.
          </p>
          <div className={cn("mt-9 flex flex-col gap-3 sm:flex-row", s.rise)} style={{ animationDelay: "240ms" }}>
            <Button asChild size="lg" className="h-12 px-6">
              <Link href={primary.href}>
                {primary.label} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-12 px-6">
              <Link href={signedIn ? "/discover" : "#how"}>Explore the Network</Link>
            </Button>
          </div>
          <ul className={cn("mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted", s.rise)} style={{ animationDelay: "320ms" }}>
            {["Explained compatibility", "Five matches a day", "Privacy you control"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-ink" strokeWidth={2.5} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className={cn("pt-6 lg:pt-0", s.rise)} style={{ animationDelay: "200ms" }}>
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── How it works ───────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Tell us who you are.",
      body: "Your skills, experience, and how you like to work. A short working-style quiz fills in what a résumé can't.",
      visual: (
        <div className="flex flex-wrap gap-1.5">
          {["Engineering", "Fintech", "Full-time", "Fast-paced"].map((t, i) => (
            <span
              key={t}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px] font-medium",
                i === 0 ? "bg-ink text-ink-foreground" : "border border-border-strong text-foreground",
              )}
            >
              {t}
            </span>
          ))}
        </div>
      ),
    },
    {
      n: "02",
      title: "Tell us what you're building.",
      body: "The problem, the stage, and what's missing — a cofounder, an advisor, a first hire, or a few hours of expert help.",
      visual: (
        <div>
          <div className="flex justify-between text-[11px] text-subtle">
            <span>Idea</span>
            <span className="font-medium text-foreground">Pre-seed</span>
            <span>Seed</span>
            <span>Growth</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-surface">
            <div className="h-full w-[38%] rounded-full bg-brand-gradient" />
          </div>
        </div>
      ),
    },
    {
      n: "03",
      title: "Meet the right people.",
      body: "Every day, a short list of people worth meeting — each with a clear explanation of why, and what to talk about.",
      visual: (
        <div className="flex items-center">
          {[
            ["Maya R", 252],
            ["Dev K", 18],
            ["Ana L", 160],
            ["Sam O", 205],
            ["Priya N", 320],
          ].map(([n, h], i) => (
            <MockAvatar key={n as string} name={n as string} hue={h as number} size={30} className={cn(i > 0 && "-ml-2")} />
          ))}
          <span className="ml-3 text-[12px] font-medium text-muted">Today&apos;s five</span>
        </div>
      ),
    },
  ];
  return (
    <Section id="how" className="border-t border-border">
      <div className="max-w-2xl">
        <Eyebrow>How You&amp;Me works</Eyebrow>
        <SectionTitle>Three steps to the people you need.</SectionTitle>
      </div>
      <ol className="mt-14 grid gap-4 md:grid-cols-3">
        {steps.map((st) => (
          <li key={st.n} className="flex flex-col rounded-[20px] border border-border bg-card p-6 sm:p-7">
            <span className="font-mono text-[13px] text-subtle">{st.n}</span>
            <h3 className="mt-6 text-[21px] leading-tight font-semibold tracking-tight">{st.title}</h3>
            <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted">{st.body}</p>
            <div aria-hidden className="mt-8 border-t border-border pt-5">
              {st.visual}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ───────────────────────────── Cofounders ───────────────────────────── */

function Cofounders() {
  const factors = [
    { icon: Wrench, label: "Skills", body: "Do you cover each other's gaps — or duplicate each other?", v: 92 },
    { icon: Gauge, label: "Commitment", body: "Full-time now, nights and weekends, or later? It matters.", v: 88 },
    { icon: Compass, label: "Working style", body: "Pace, structure, communication, and how decisions get made.", v: 71 },
    { icon: Target, label: "Ambition", body: "Venture-scale, profitable and independent, or impact-first.", v: 85 },
  ];
  return (
    <Section id="cofounders" className="bg-surface/60">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <Eyebrow>Cofounders</Eyebrow>
          <SectionTitle>Find someone you can actually build with.</SectionTitle>
          <Lead>
            A great cofounder isn&apos;t just a great résumé. You&amp;Me looks at how your skills fit together, how committed you each are, how you
            work, and where you want to go — then tells you exactly why.
          </Lead>
          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {factors.map((f) => (
              <li key={f.label}>
                <f.icon className="size-5 text-brand-ink" aria-hidden />
                <p className="mt-3 text-[15px] font-semibold">{f.label}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 lg:pt-10">
          <div aria-hidden className="rounded-[22px] border border-border bg-card p-6 shadow-soft sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex">
                  <MockAvatar name="You" hue={40} size={36} />
                  <MockAvatar name="Ana L" hue={160} size={36} className="-ml-2.5" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold tracking-tight">You &amp; Ana L.</p>
                  <p className="text-[12px] text-subtle">Why you two</p>
                </div>
              </div>
              <MockRing score={84} size={52} stroke={4} animated={false} />
            </div>
            <ul className="mt-6 space-y-4">
              {factors.map((f) => (
                <li key={f.label}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-subtle tabular-nums">{f.v}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface">
                    <div className="h-full rounded-full bg-foreground/85" style={{ width: `${f.v}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-border pt-4 text-[13px] leading-relaxed text-muted">
              <span className="font-medium text-foreground">Talk about early:</span> you prefer fast, instinctive calls; Ana likes to decide with
              data. Neither is wrong — agree on how you&apos;ll decide.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-[22px] bg-ink p-6 text-ink-foreground sm:p-7 dark:bg-brand-soft dark:text-foreground">
            <span className="text-[44px] leading-none font-semibold tracking-[-0.05em] tabular-nums">5</span>
            <div>
              <p className="text-[16px] font-semibold tracking-tight">Five a day. Quality over quantity.</p>
              <p className="mt-0.5 text-[13.5px] opacity-70">No endless swiping. A short list, chosen with care, refreshed daily.</p>
            </div>
          </div>
          <p className="text-center text-[12px] text-subtle">Illustrative example.</p>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────────── Consultants ───────────────────────────── */

function Consultants() {
  const cats = [
    { icon: TrendingUp, label: "Growth" },
    { icon: Scale, label: "Legal" },
    { icon: Briefcase, label: "Fundraising" },
    { icon: Palette, label: "Design" },
    { icon: Wrench, label: "Engineering" },
    { icon: Users, label: "Hiring" },
    { icon: Megaphone, label: "Marketing" },
    { icon: Lightbulb, label: "Product" },
  ];
  return (
    <Section id="consultants">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-20">
        <div className="lg:order-2">
          <Eyebrow>Consultants</Eyebrow>
          <SectionTitle>Expertise when you need it.</SectionTitle>
          <Lead>
            Growth, legal, fundraising, design and more — from people who&apos;ve done it before. Book a focused session, pay securely, and bring your
            cofounder into the room.
          </Lead>
          <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cats.map((c) => (
              <li key={c.label} className="flex items-center gap-2 rounded-[12px] border border-border bg-card px-3 py-2.5 text-[13.5px] font-medium">
                <c.icon className="size-4 text-muted" aria-hidden />
                {c.label}
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden className="relative lg:order-1">
          <div className="rounded-[22px] border border-border bg-card p-6 shadow-soft sm:p-7">
            <div className="flex items-start gap-4">
              <MockAvatar name="Jordan P" hue={200} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[16px] font-semibold tracking-tight">Jordan P.</p>
                  <BadgeCheck className="size-4 text-brand-ink" />
                </div>
                <p className="text-[13px] text-muted">Fundraising · Pre-seed to Series A</p>
              </div>
            </div>
            <div className="mt-6 rounded-[16px] border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold">Pitch deck & raise strategy</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">60 min · Video call</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-brand-ink">Fixed price</span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[12px]">
                {["Tue 10:00", "Tue 14:30", "Wed 09:00", "Thu 16:00"].map((t, i) => (
                  <span
                    key={t}
                    className={cn(
                      "rounded-[8px] border px-1 py-2",
                      i === 1 ? "border-foreground bg-ink font-medium text-ink-foreground" : "border-border text-muted",
                    )}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] bg-surface px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex">
                  <MockAvatar name="You" hue={40} size={26} />
                  <MockAvatar name="Maya R" hue={252} size={26} className="-ml-2" />
                </div>
                <span className="text-[13px] font-medium">You + your cofounder</span>
              </div>
              <Calendar className="size-4 text-muted" />
            </div>
          </div>
          <p className="mt-3 text-center text-[12px] text-subtle">Illustrative example.</p>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────────── AI ───────────────────────────── */

function AI() {
  return (
    <section id="ai" className="scroll-mt-20 px-3 sm:px-8">
      <div className={cn("mx-auto max-w-6xl overflow-hidden rounded-[28px] px-5 py-16 text-white sm:px-12 sm:py-24", s.darkPanel)}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-[#b3abff]">
              <Sparkles className="size-3.5" aria-hidden />
              You&amp;Me AI
            </p>
            <h2 className="mt-4 text-[34px] leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-[48px] lg:text-[54px]">
              Describe what you need. You&amp;Me finds who can help.
            </h2>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/65">
              Ask in plain language. The concierge searches real profiles on You&amp;Me — people, consultants, and startups — and explains why each
              one fits. It never invents people, and it only uses what members choose to share.
            </p>
          </div>

          <div aria-hidden className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="ml-auto max-w-[88%] rounded-[16px] rounded-br-[6px] bg-white px-4 py-3 text-[14px] leading-relaxed text-[#111116]">
              We&apos;re a pre-seed fintech in Berlin. I need someone who&apos;s set up EU payment licensing before.
            </div>
            <div className="mt-4 flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient">
                <Sparkles className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-relaxed text-white/85">
                  Here are consultants who&apos;ve worked on EU payments compliance with early-stage teams. Two have availability this week.
                </p>
                <ul className="mt-3 space-y-2">
                  {[
                    { n: "Elena V.", r: "Payments & licensing counsel", h: 280 },
                    { n: "Tomas B.", r: "Fintech compliance advisor", h: 120 },
                  ].map((p) => (
                    <li key={p.n} className="flex items-center gap-3 rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
                      <MockAvatar name={p.n} hue={p.h} size={30} className="ring-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium">{p.n}</span>
                        <span className="block truncate text-[12px] text-white/55">{p.r}</span>
                      </span>
                      <ArrowRight className="size-4 text-white/40" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-[12px] border border-white/10 bg-black/20 px-3.5 py-3 text-[13px] text-white/45">
              <span className="flex-1">Ask about people, consultants, or your team…</span>
              <span className={cn("h-4 w-px bg-white/60", s.caret)} />
              <span className="flex size-7 items-center justify-center rounded-full bg-white text-[#111116]">
                <ArrowUp className="size-3.5" />
              </span>
            </div>
            <p className="mt-3 text-center text-[11.5px] text-white/35">Illustrative conversation.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Startups ───────────────────────────── */

function Startups() {
  return (
    <Section id="startups">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div>
          <Eyebrow>Startups</Eyebrow>
          <SectionTitle>Build your startup identity.</SectionTitle>
          <Lead>
            Give your company a home: what you&apos;re building, who&apos;s on the team, what you need right now, and the roles you&apos;re hiring for. The
            right people find you — and you decide what&apos;s public.
          </Lead>
          <ul className="mt-8 space-y-3 text-[15px]">
            {["A profile that explains the problem, not just the pitch", "Your team, with roles and admins", "Needs and open roles the network can answer"].map(
              (t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  {t}
                </li>
              ),
            )}
          </ul>
        </div>

        <div aria-hidden>
          <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-soft">
            <div className="h-20 bg-[linear-gradient(120deg,var(--brand-soft),var(--surface)_70%)]" />
            <div className="px-6 pb-6 sm:px-7">
              <div className="relative -mt-7 flex size-14 items-center justify-center rounded-[16px] border-4 border-card bg-ink text-[18px] font-semibold text-ink-foreground">
                F
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-[19px] font-semibold tracking-tight">Fieldnote</p>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-muted">Pre-seed</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-muted">Climate software</span>
              </div>
              <p className="mt-1.5 text-[14px] text-muted">Carbon accounting that small manufacturers can actually use.</p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-[11.5px] font-medium tracking-wide text-subtle uppercase">Team</p>
                  <div className="mt-2.5 flex items-center">
                    <MockAvatar name="Lee W" hue={30} size={30} />
                    <MockAvatar name="Rin S" hue={190} size={30} className="-ml-2" />
                    <span className="-ml-2 flex size-[30px] items-center justify-center rounded-full border border-dashed border-border-strong bg-card text-[14px] text-subtle">
                      +
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[11.5px] font-medium tracking-wide text-subtle uppercase">Needs now</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-medium text-brand-ink">Technical cofounder</span>
                    <span className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium">Fundraising advice</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-border pt-5">
                <p className="text-[11.5px] font-medium tracking-wide text-subtle uppercase">Open roles</p>
                <ul className="mt-2 divide-y divide-border">
                  {[
                    ["Founding engineer", "Full-time · Remote (EU)"],
                    ["Product designer", "Part-time · Contract"],
                  ].map(([r, m]) => (
                    <li key={r} className="flex items-center justify-between py-2.5 text-[14px]">
                      <span className="font-medium">{r}</span>
                      <span className="text-[12.5px] text-muted">{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[12px] text-subtle">Illustrative example.</p>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────────── Stages (honest social proof) ───────────────────────────── */

function Stages() {
  const stages = ["Idea", "Pre-seed", "Seed", "Series A", "Growth"];
  const people = [
    { icon: Lightbulb, title: "Founders with an idea", body: "Looking for the cofounder who makes it real." },
    { icon: Rocket, title: "Early teams", body: "Filling gaps with advisors, experts, and first hires." },
    { icon: Users, title: "Operators & experts", body: "Ready to join early, consult, or advise." },
  ];
  return (
    <Section className="border-t border-border">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow className="justify-center">For every stage</Eyebrow>
        <SectionTitle>Built for founders at every stage.</SectionTitle>
        <Lead className="mx-auto">From a notebook sketch to a scaling team — the people you need change. You&amp;Me changes with you.</Lead>
      </div>
      <ol className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-0">
        {stages.map((st, i) => (
          <li key={st} className="flex items-center">
            <span className="rounded-full border border-border-strong bg-card px-4 py-2 text-[14px] font-medium">{st}</span>
            {i < stages.length - 1 && <span aria-hidden className="mx-2 hidden h-px w-8 bg-border-strong sm:block" />}
          </li>
        ))}
      </ol>
      <ul className="mt-16 grid gap-4 sm:grid-cols-3">
        {people.map((p) => (
          <li key={p.title} className="rounded-[20px] border border-border bg-card p-6">
            <p.icon className="size-5 text-brand-ink" aria-hidden />
            <p className="mt-4 text-[16px] font-semibold tracking-tight">{p.title}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ───────────────────────────── Final CTA ───────────────────────────── */

function FinalCta({ primary, showWaitlist }: { primary: { href: string; label: string }; showWaitlist: boolean }) {
  return (
    <section className="px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-border bg-card px-6 py-16 text-center sm:px-12 sm:py-24">
        <div aria-hidden className={cn("pointer-events-none absolute inset-0", s.grid)} />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl text-[32px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[48px] lg:text-[56px]">
            Your startup doesn&apos;t need more connections. <span className="text-gradient">It needs the right ones.</span>
          </h2>
          <p className="mt-5 text-[17px] text-muted sm:text-[18px]">Fewer introductions. Better matches.</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6">
              <Link href={primary.href}>
                {primary.label} <ArrowRight />
              </Link>
            </Button>
            {showWaitlist && (
              <Button asChild size="lg" variant="secondary" className="h-12 px-6">
                <Link href="/waitlist">Join the waitlist</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
