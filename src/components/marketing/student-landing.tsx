import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Clock, GraduationCap, Lock, QrCode, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockAvatar } from "@/components/marketing/hero-mockup";
import { Eyebrow, Lead, Section, SectionTitle } from "@/components/marketing/section";
import s from "@/components/marketing/marketing.module.css";
import { SCHOOLS } from "@/lib/schools";
import { cn } from "@/lib/utils";

type Cta = { href: string; label: string };

/** Landing page shown when STUDENT_MODE is on. The original landing page is untouched. */
export function StudentLanding({ primary, signedIn }: { primary: Cta; signedIn: boolean }) {
  return (
    <>
      <Hero primary={primary} signedIn={signedIn} />
      <HowItWorks />
      <WhyYouTwo />
      <Events />
      <Campuses />
      <Privacy />
      <FinalCta primary={primary} />
    </>
  );
}

const PEOPLE = [
  { name: "Maya R", hue: 252, line: "Mechanical engineering, junior", why: "You've got the idea; she's built hardware prototypes." },
  { name: "Dev K", hue: 18, line: "CS, sophomore", why: "Both putting in ~10 hrs/week this semester." },
  { name: "Ana L", hue: 160, line: "Stern MBA", why: "Wants to join an idea — and has sold B2B before." },
];

function Hero({ primary, signedIn }: { primary: Cta; signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden px-5 pt-14 pb-20 sm:px-8 sm:pt-20 lg:pt-24 lg:pb-28">
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10", s.grid)} />
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10", s.glow)} />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className={cn("inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[13px] text-muted", s.rise)}>
            <GraduationCap className="size-3.5 text-brand-ink" aria-hidden />
            For student founders · {SCHOOLS.map((x) => x.shortName).join(" · ")}
          </p>
          <h1
            className={cn("mt-6 text-[42px] leading-[1] font-semibold tracking-[-0.045em] text-balance sm:text-[60px] lg:text-[70px]", s.rise)}
            style={{ animationDelay: "80ms" }}
          >
            Find your cofounder on campus <span className="text-gradient">— and across campuses.</span>
          </h1>
          <p className={cn("mt-6 max-w-[34rem] text-[18px] leading-relaxed text-pretty text-muted sm:text-[20px]", s.rise)} style={{ animationDelay: "160ms" }}>
            Sign up with your school email, tell us what you&apos;re good at and how much time you have between classes. We introduce you to students
            worth building with — and tell you why, in plain words.
          </p>
          <div className={cn("mt-9 flex flex-col gap-3 sm:flex-row", s.rise)} style={{ animationDelay: "240ms" }}>
            <Button asChild size="lg" className="h-12 px-6">
              <Link href={primary.href}>
                {signedIn ? primary.label : "Join with your school email"} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-12 px-6">
              <Link href="/#how">How it works</Link>
            </Button>
          </div>
          <ul className={cn("mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted", s.rise)} style={{ animationDelay: "320ms" }}>
            {["Verified students only", "Reasons, not just scores", "Made for team-hunt events"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-ink" strokeWidth={2.5} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className={cn(s.rise)} style={{ animationDelay: "200ms" }}>
          <TonightMockup />
        </div>
      </div>
    </section>
  );
}

function TonightMockup() {
  return (
    <div aria-hidden>
      <div className="mx-auto max-w-md rounded-[24px] border border-border bg-card p-5 shadow-float sm:p-6">
        <p className="text-[12px] font-medium text-brand-ink">Startup Team Hunt · Tonight</p>
        <p className="mt-1 text-[20px] font-semibold tracking-tight">Your 5 people to meet</p>
        <ul className="mt-5 space-y-3">
          {PEOPLE.map((p) => (
            <li key={p.name} className="flex items-start gap-3 rounded-[14px] border border-border bg-background p-3">
              <MockAvatar name={p.name} hue={p.hue} size={38} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{p.name}.</p>
                <p className="text-[12px] text-subtle">{p.line}</p>
                <p className="mt-1.5 text-[13px] leading-snug text-foreground">{p.why}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[12px] text-subtle">+ 2 more</p>
      </div>
      <p className="mt-3 text-center text-[12px] text-subtle">Illustrative example.</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: BadgeCheck, title: "Verify your school email.", body: "Only students with a confirmed university address can see or be seen. No recruiters, no randoms." },
    {
      icon: Clock,
      title: "Build a profile in 3 minutes.",
      body: "Your year, major, skills, whether you have an idea or want to join one, and how many hours you can really give around classes.",
    },
    { icon: Users, title: "Meet the right people.", body: "A short list of students worth meeting — each with one clear reason why. Stay on your campus or open up to others." },
  ];
  return (
    <Section id="how" className="border-t border-border">
      <div className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <SectionTitle>Three steps to your founding team.</SectionTitle>
      </div>
      <ol className="mt-14 grid gap-4 md:grid-cols-3">
        {steps.map((st, i) => (
          <li key={st.title} className="flex flex-col rounded-[20px] border border-border bg-card p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <st.icon className="size-5 text-brand-ink" aria-hidden />
              <span className="font-mono text-[13px] text-subtle">0{i + 1}</span>
            </div>
            <h3 className="mt-6 text-[21px] leading-tight font-semibold tracking-tight">{st.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{st.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function WhyYouTwo() {
  const reasons = [
    ["Complementary skills", "You build the product; Sam has run sales for a campus club and wants to own go-to-market."],
    ["Same commitment", "You're both giving about 10 hours a week this semester and want to go full-time over the summer."],
    ["Shared interests", "You both care about climate and education."],
  ];
  return (
    <Section id="cofounders" className="bg-surface/60">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <Eyebrow>Why you two</Eyebrow>
          <SectionTitle>Reasons, not just a number.</SectionTitle>
          <Lead>
            Every introduction comes with plain-language reasons: how your skills fit, whether you can give the same time, and what you both care
            about. Plus what to talk about early — before it becomes a problem.
          </Lead>
        </div>
        <div aria-hidden className="rounded-[22px] border border-border bg-card p-6 shadow-soft sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex">
              <MockAvatar name="You" hue={40} size={36} />
              <MockAvatar name="Sam O" hue={205} size={36} className="-ml-2.5" />
            </div>
            <p className="text-[15px] font-semibold tracking-tight">You &amp; Sam O.</p>
          </div>
          <ul className="mt-6 space-y-4">
            {reasons.map(([t, b]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold">{t}</span>
                  <span className="block text-[13.5px] leading-relaxed text-muted">{b}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-border pt-4 text-[13px] leading-relaxed text-muted">
            <span className="font-medium text-foreground">Talk about early:</span> what happens after graduation.
          </p>
          <p className="mt-4 text-center text-[12px] text-subtle">Illustrative example.</p>
        </div>
      </div>
    </Section>
  );
}

function Events() {
  return (
    <Section id="events">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div className="lg:order-2">
          <Eyebrow>For entrepreneurship centers</Eyebrow>
          <SectionTitle>Run your team hunt on FoundMate.</SectionTitle>
          <Lead>
            Create an event and put the QR code on the screen. Students scan it, fill in a short profile on their phone, and get their five people
            to meet that night — with a reason for each. The matches stay in the app after the room empties.
          </Lead>
          <Button asChild variant="secondary" size="lg" className="mt-8 h-12 px-6">
            <a href="mailto:hello@youandme.company?subject=Running%20a%20team%20hunt%20on%20You%26Me">Talk to us about your event</a>
          </Button>
        </div>
        <div aria-hidden className="lg:order-1">
          <div className="mx-auto flex max-w-sm flex-col items-center rounded-[22px] border border-border bg-card p-8 text-center shadow-soft">
            <p className="text-[12px] font-medium text-brand-ink">Startup Team Hunt</p>
            <p className="mt-1 text-[18px] font-semibold tracking-tight">Scan to join</p>
            <div className="mt-5 flex size-40 items-center justify-center rounded-[16px] border border-border bg-background">
              <QrCode className="size-28 text-foreground" strokeWidth={1.2} />
            </div>
            <p className="mt-5 text-[13px] text-muted">Profile in under 3 minutes · works on any phone</p>
          </div>
          <p className="mt-3 text-center text-[12px] text-subtle">Illustrative example.</p>
        </div>
      </div>
    </Section>
  );
}

function Campuses() {
  const soon = ["Advisors & mentors", "Startup profiles", "Open roles", "Expert help"];
  return (
    <Section className="border-t border-border">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow className="justify-center">Campuses</Eyebrow>
        <SectionTitle>Starting with {SCHOOLS.map((x) => x.shortName).join(" and ")}.</SectionTitle>
        <Lead className="mx-auto">
          Keep it to your campus, or open up to student founders at other schools. More universities are coming.
        </Lead>
      </div>
      <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
        {SCHOOLS.map((x) => (
          <li key={x.slug} className="rounded-full border border-border-strong bg-card px-4 py-2 text-[14px] font-medium">
            {x.name}
          </li>
        ))}
      </ul>
      <div className="mx-auto mt-14 max-w-3xl text-center">
        <p className="text-[13px] font-medium text-subtle">Coming soon</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {soon.map((t) => (
            <li key={t} className="rounded-full bg-surface px-3 py-1.5 text-[13px] text-muted">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Privacy() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="mx-auto flex max-w-3xl gap-4 rounded-[20px] border border-border bg-card p-6 sm:p-7">
        <Lock className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
        <div>
          <p className="text-[16px] font-semibold tracking-tight">Who can see your profile</p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            Only students who have confirmed a university email and chosen to be visible. Your profile isn&apos;t public on the web and isn&apos;t
            indexed by search engines. You can hide it, or limit it to your own school, at any time in Settings.{" "}
            <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
              Privacy policy
            </Link>
          </p>
        </div>
      </div>
    </Section>
  );
}

function FinalCta({ primary }: { primary: Cta }) {
  return (
    <section className="px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-border bg-card px-6 py-16 text-center sm:px-12 sm:py-24">
        <div aria-hidden className={cn("pointer-events-none absolute inset-0", s.grid)} />
        <div className="relative">
          <Sparkles className="mx-auto size-6 text-brand-ink" aria-hidden />
          <h2 className="mx-auto mt-4 max-w-3xl text-[32px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[48px]">
            The best time to find a cofounder is <span className="text-gradient">while you&apos;re still in school.</span>
          </h2>
          <div className="mt-9 flex justify-center">
            <Button asChild size="lg" className="h-12 px-6">
              <Link href={primary.href}>
                {primary.label} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
