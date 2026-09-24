"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Briefcase,
  Compass,
  GraduationCap,
  Handshake,
  Lightbulb,
  Rocket,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, OptionCard } from "@/components/ui/chip";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { LogoMark } from "@/components/shell/logo";
import { saveOnboardingStep, finishOnboarding, type OnboardingStepInput } from "@/app/onboarding/actions";
import {
  AMBITIONS,
  AMBITION_LABELS,
  AVAILABILITY,
  AVAILABILITY_LABELS,
  COFOUNDER_TYPES,
  COFOUNDER_TYPE_LABELS,
  COMMITMENTS,
  COMMITMENT_LABELS,
  FOUNDER_EXPERIENCE,
  FOUNDER_EXPERIENCE_LABELS,
  INTENTS,
  INTENT_LABELS,
  SKILL_CATEGORY_LABELS,
  STAGE_LABELS,
  STARTUP_STAGES,
  WORK_MODES,
  WORK_MODE_LABELS,
  type Ambition,
  type Availability,
  type CofounderType,
  type Commitment,
  type FounderExperience,
  type Intent,
  type SkillCategory,
  type StartupStage,
  type WorkMode,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

type Draft = {
  stepIndex: number;
  displayName: string;
  headline: string;
  intents: Intent[];
  city: string;
  country: string;
  currentRole: string;
  currentCompany: string;
  university: string;
  yearsExperience: number | null;
  skillIds: string[];
  industryIds: string[];
  hasStartup: "yes" | "no" | null;
  startup: { name: string; tagline: string; stage: StartupStage | null; teamSize: number };
  lookingForCofounder: boolean;
  cofounderTypes: CofounderType[];
  missingSkillIds?: string[];
  helpCategoryIds?: string[];
  commitment: Commitment | null;
  availability: Availability | null;
  workMode: WorkMode | null;
  stagePreferences: StartupStage[];
  ambition: Ambition | null;
  founderExperience: FounderExperience | null;
  equityExpectation: string;
  lookingFor: string;
};

type StepPayload = OnboardingStepInput extends infer U ? (U extends unknown ? Omit<U, "index"> : never) : never;

type Option = { id: string; name: string; category?: string; description?: string | null };

type Step = {
  key: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  optional?: boolean;
  canContinue: boolean;
  body: React.ReactNode;
  payload: () => StepPayload | null;
};

const INTENT_ICONS: Record<Intent, React.ReactNode> = {
  building: <Rocket />,
  cofounder: <Handshake />,
  join: <Users />,
  consult: <Briefcase />,
  advise: <Lightbulb />,
  exploring: <Compass />,
};

const STAGE_HINTS: Record<StartupStage, string> = {
  idea: "Still shaping the problem",
  validation: "Talking to customers",
  prototype: "Something clickable exists",
  mvp: "Real users are trying it",
  pre_revenue: "Live, not charging yet",
  revenue: "Customers are paying",
  growth: "Scaling what works",
  fundraising: "Actively raising",
};

function toggle<T>(list: T[], item: T, max = Infinity) {
  return list.includes(item) ? list.filter((x) => x !== item) : list.length >= max ? list : [...list, item];
}

function SkillPicker({ skills, selected, onChange, max }: { skills: Option[]; selected: string[]; onChange: (ids: string[]) => void; max: number }) {
  const [query, setQuery] = React.useState("");
  const grouped = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Option[]>();
    for (const s of skills) {
      if (q && !s.name.toLowerCase().includes(q)) continue;
      const key = s.category ?? "other";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [skills, query]);
  return (
    <div>
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" className="pl-10" aria-label="Search skills" />
      </div>
      <p className="mb-4 text-[13px] text-muted" aria-live="polite">
        {selected.length} of {max} selected
      </p>
      <div className="space-y-5">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">{SKILL_CATEGORY_LABELS[category as SkillCategory] ?? category}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((s) => (
                <Chip key={s.id} size="sm" selected={selected.includes(s.id)} onToggle={() => onChange(toggle(selected, s.id, max))}>
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        {!grouped.length && <p className="text-sm text-muted">No skills match “{query}”.</p>}
      </div>
    </div>
  );
}

export function OnboardingFlow({
  initial,
  skills,
  industries,
  categories,
}: {
  initial: Draft;
  skills: Option[];
  industries: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [d, setD] = React.useState<Draft>(initial);
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  const building = d.intents.includes("building");
  const cofounderSeeker = d.intents.includes("cofounder");
  const founderTrack = building || cofounderSeeker;

  const steps: Step[] = React.useMemo(() => {
    const list: Step[] = [
      {
        key: "intents",
        eyebrow: "Welcome to You&Me",
        title: "What brings you to You&Me?",
        subtitle: "Pick everything that applies. This shapes who we introduce you to.",
        canContinue: d.intents.length > 0,
        body: (
          <div className="grid gap-2.5" role="group" aria-label="What brings you here">
            {INTENTS.map((i) => (
              <OptionCard key={i} multi selected={d.intents.includes(i)} onSelect={() => set("intents", toggle(d.intents, i))} title={INTENT_LABELS[i]} icon={INTENT_ICONS[i]} />
            ))}
          </div>
        ),
        payload: () => ({ step: "profile", patch: { intents: d.intents } }),
      },
      {
        key: "basics",
        title: "How should people know you?",
        subtitle: "Your name and a one-line headline. Keep it human.",
        canContinue: d.displayName.trim().length > 0,
        body: (
          <div className="space-y-5">
            <Field label="Full name" htmlFor="name">
              <Input id="name" value={d.displayName} onChange={(e) => set("displayName", e.target.value)} autoComplete="name" maxLength={80} autoFocus />
            </Field>
            <Field label="Headline" htmlFor="headline" hint="e.g. “ML engineer excited about health” or “Building calmer care for families”" optional>
              <Input id="headline" value={d.headline} onChange={(e) => set("headline", e.target.value)} maxLength={120} />
            </Field>
          </div>
        ),
        payload: () => ({ step: "profile", patch: { displayName: d.displayName, headline: d.headline } }),
      },
      {
        key: "location",
        title: "Where are you based?",
        subtitle: "Helps with in-person matches and time zones. We only show your city and country.",
        canContinue: true,
        optional: true,
        body: (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="City" htmlFor="city">
              <Input id="city" value={d.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" maxLength={80} />
            </Field>
            <Field label="Country" htmlFor="country">
              <Input id="country" value={d.country} onChange={(e) => set("country", e.target.value)} autoComplete="country-name" maxLength={80} />
            </Field>
          </div>
        ),
        payload: () => ({
          step: "profile",
          patch: { city: d.city, country: d.country, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
        }),
      },
      {
        key: "background",
        title: "What's your background?",
        subtitle: "Where you work or study now. You can add full experience later.",
        canContinue: true,
        optional: true,
        body: (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Current role" htmlFor="role">
                <Input id="role" value={d.currentRole} onChange={(e) => set("currentRole", e.target.value)} maxLength={100} />
              </Field>
              <Field label="Company" htmlFor="company">
                <Input id="company" value={d.currentCompany} onChange={(e) => set("currentCompany", e.target.value)} maxLength={100} />
              </Field>
            </div>
            <Field label="University" htmlFor="university" optional>
              <Input id="university" value={d.university} onChange={(e) => set("university", e.target.value)} maxLength={120} />
            </Field>
            <Field label="Years of professional experience" htmlFor="years" optional>
              <Input
                id="years"
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                value={d.yearsExperience ?? ""}
                onChange={(e) => set("yearsExperience", e.target.value === "" ? null : Math.max(0, Math.min(60, Number(e.target.value))))}
                className="max-w-32"
              />
            </Field>
          </div>
        ),
        payload: () => ({
          step: "profile",
          patch: { currentRole: d.currentRole, currentCompany: d.currentCompany, university: d.university, yearsExperience: d.yearsExperience },
        }),
      },
      {
        key: "skills",
        title: "What are you great at?",
        subtitle: "Choose up to 8. Your first two become your headline skills.",
        canContinue: d.skillIds.length > 0,
        body: <SkillPicker skills={skills} selected={d.skillIds} onChange={(ids) => set("skillIds", ids)} max={8} />,
        payload: () => ({ step: "skills", skillIds: d.skillIds }),
      },
      {
        key: "industries",
        title: "Which spaces pull you in?",
        subtitle: "Up to 5. We use these to find people who care about the same problems.",
        canContinue: d.industryIds.length > 0,
        body: (
          <div className="flex flex-wrap gap-2">
            {industries.map((i) => (
              <Chip key={i.id} selected={d.industryIds.includes(i.id)} onToggle={() => set("industryIds", toggle(d.industryIds, i.id, 5))}>
                {i.name}
              </Chip>
            ))}
          </div>
        ),
        payload: () => ({ step: "industries", industryIds: d.industryIds }),
      },
    ];

    if (building) {
      list.push({
        key: "has-startup",
        eyebrow: "Your startup",
        title: "Do you already have a startup?",
        subtitle: "An idea counts. You can also skip this and set it up later.",
        canContinue: d.hasStartup !== null,
        body: (
          <div className="grid gap-2.5" role="radiogroup">
            <OptionCard selected={d.hasStartup === "yes"} onSelect={() => set("hasStartup", "yes")} title="Yes — let's add it" description="Name, stage and a one-liner. Takes a minute." icon={<Rocket />} />
            <OptionCard selected={d.hasStartup === "no"} onSelect={() => set("hasStartup", "no")} title="Not yet, or I'll add it later" description="You can create your startup profile anytime." icon={<Sparkles />} />
          </div>
        ),
        payload: () => null,
      });
      if (d.hasStartup === "yes") {
        list.push(
          {
            key: "startup-what",
            eyebrow: "Your startup",
            title: "What are you building?",
            subtitle: "One sentence. Plain words beat buzzwords.",
            canContinue: d.startup.tagline.trim().length > 3,
            body: (
              <Textarea
                aria-label="What are you building"
                value={d.startup.tagline}
                maxLength={140}
                onChange={(e) => set("startup", { ...d.startup, tagline: e.target.value })}
                placeholder="A shared care hub that helps families coordinate an aging parent's care."
                autoFocus
              />
            ),
            payload: () => null,
          },
          {
            key: "startup-name",
            eyebrow: "Your startup",
            title: "What's it called?",
            subtitle: "A working name is fine.",
            canContinue: d.startup.name.trim().length > 0,
            body: <Input aria-label="Startup name" value={d.startup.name} maxLength={80} onChange={(e) => set("startup", { ...d.startup, name: e.target.value })} autoFocus />,
            payload: () => null,
          },
          {
            key: "startup-stage",
            eyebrow: "Your startup",
            title: "What stage are you at?",
            canContinue: !!d.startup.stage,
            body: (
              <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup">
                {STARTUP_STAGES.map((s) => (
                  <OptionCard key={s} selected={d.startup.stage === s} onSelect={() => set("startup", { ...d.startup, stage: s })} title={STAGE_LABELS[s]} description={STAGE_HINTS[s]} />
                ))}
              </div>
            ),
            payload: () => null,
          },
          {
            key: "startup-team",
            eyebrow: "Your startup",
            title: "How big is the team today?",
            subtitle: "Including you.",
            canContinue: d.startup.teamSize >= 1,
            body: (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 8, 12].map((n) => (
                  <Chip key={n} selected={d.startup.teamSize === n} onToggle={() => set("startup", { ...d.startup, teamSize: n })}>
                    {n === 1 ? "Just me" : n === 12 ? "10+" : n}
                  </Chip>
                ))}
              </div>
            ),
            payload: () =>
              d.startup.stage
                ? { step: "startup", startup: { name: d.startup.name, tagline: d.startup.tagline, stage: d.startup.stage, teamSize: d.startup.teamSize } }
                : null,
          },
        );
      }
    }

    if (founderTrack) {
      list.push({
        key: "cofounder",
        eyebrow: "Cofounders",
        title: building ? "Are you looking for a cofounder?" : "What kind of cofounder would complete your team?",
        subtitle: "We'll show you five carefully chosen people a day — never an endless feed.",
        canContinue: !d.lookingForCofounder || d.cofounderTypes.length > 0,
        body: (
          <div className="space-y-6">
            {building && (
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup">
                <OptionCard selected={d.lookingForCofounder} onSelect={() => set("lookingForCofounder", true)} title="Yes" />
                <OptionCard selected={!d.lookingForCofounder} onSelect={() => setD((p) => ({ ...p, lookingForCofounder: false, cofounderTypes: [] }))} title="Not right now" />
              </div>
            )}
            {(d.lookingForCofounder || !building) && (
              <div>
                <p className="mb-3 text-sm font-medium">What type of cofounder?</p>
                <div className="flex flex-wrap gap-2">
                  {COFOUNDER_TYPES.map((t) => (
                    <Chip key={t} selected={d.cofounderTypes.includes(t)} onToggle={() => setD((p) => ({ ...p, lookingForCofounder: true, cofounderTypes: toggle(p.cofounderTypes, t) }))}>
                      {COFOUNDER_TYPE_LABELS[t]}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        ),
        payload: () => ({ step: "profile", patch: { lookingForCofounder: d.lookingForCofounder || (!building && d.cofounderTypes.length > 0), cofounderTypes: d.cofounderTypes } }),
      });
      if (d.lookingForCofounder || (!building && d.cofounderTypes.length > 0)) {
        list.push({
          key: "missing-skills",
          eyebrow: "Cofounders",
          title: "What skills are you missing?",
          subtitle: "Be specific — this is the strongest signal we use to find your match.",
          optional: true,
          canContinue: true,
          body: <SkillPicker skills={skills.filter((s) => !d.skillIds.includes(s.id))} selected={d.missingSkillIds ?? []} onChange={(ids) => set("missingSkillIds", ids)} max={6} />,
          payload: () => ({ step: "missing_skills", skillIds: d.missingSkillIds ?? [] }),
        });
      }
    }

    if (building) {
      list.push({
        key: "help",
        eyebrow: "Expertise",
        title: "What kind of help do you need right now?",
        subtitle: "We'll recommend consultants for these. No cofounder required.",
        optional: true,
        canContinue: true,
        body: (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c.id} selected={(d.helpCategoryIds ?? []).includes(c.id)} onToggle={() => set("helpCategoryIds", toggle(d.helpCategoryIds ?? [], c.id, 6))}>
                {c.name}
              </Chip>
            ))}
          </div>
        ),
        payload: () => ({ step: "help", categoryIds: d.helpCategoryIds ?? [] }),
      });
    }

    list.push({
      key: "commitment",
      eyebrow: "Commitment",
      title: founderTrack ? "How committed are you right now?" : "How much time can you give?",
      subtitle: "Honest answers make better matches.",
      canContinue: !!d.availability && (!founderTrack || !!d.commitment),
      body: (
        <div className="space-y-7">
          {founderTrack && (
            <div>
              <p className="mb-3 text-sm font-medium">Commitment level</p>
              <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup">
                {COMMITMENTS.map((c) => (
                  <OptionCard key={c} selected={d.commitment === c} onSelect={() => set("commitment", c)} title={COMMITMENT_LABELS[c]} />
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="mb-3 text-sm font-medium">Time available</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY.map((a) => (
                <Chip key={a} selected={d.availability === a} onToggle={() => set("availability", a)}>
                  {AVAILABILITY_LABELS[a]}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ),
      payload: () => ({ step: "profile", patch: { commitment: d.commitment, availability: d.availability } }),
    });

    if (founderTrack) {
      list.push(
        {
          key: "workmode",
          eyebrow: "How you work",
          title: "Remote, in person, or both?",
          canContinue: !!d.workMode,
          body: (
            <div className="space-y-7">
              <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup">
                {WORK_MODES.map((w) => (
                  <OptionCard key={w} selected={d.workMode === w} onSelect={() => set("workMode", w)} title={WORK_MODE_LABELS[w]} />
                ))}
              </div>
              <div>
                <p className="mb-3 text-sm font-medium">Which startup stages interest you?</p>
                <div className="flex flex-wrap gap-2">
                  {STARTUP_STAGES.map((s) => (
                    <Chip key={s} size="sm" selected={d.stagePreferences.includes(s)} onToggle={() => set("stagePreferences", toggle(d.stagePreferences, s))}>
                      {STAGE_LABELS[s]}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          ),
          payload: () => ({ step: "profile", patch: { workMode: d.workMode, stagePreferences: d.stagePreferences } }),
        },
        {
          key: "ambition",
          eyebrow: "Ambition",
          title: "What are you hoping to build?",
          subtitle: "Mismatched ambitions end more cofounder relationships than anything else.",
          canContinue: !!d.ambition,
          body: (
            <div className="grid gap-2.5" role="radiogroup">
              {AMBITIONS.map((a) => (
                <OptionCard key={a} selected={d.ambition === a} onSelect={() => set("ambition", a)} title={AMBITION_LABELS[a]} />
              ))}
            </div>
          ),
          payload: () => ({ step: "profile", patch: { ambition: d.ambition } }),
        },
        {
          key: "experience",
          eyebrow: "Experience",
          title: "Have you founded before?",
          canContinue: !!d.founderExperience,
          body: (
            <div className="space-y-6">
              <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup">
                {FOUNDER_EXPERIENCE.map((f) => (
                  <OptionCard key={f} selected={d.founderExperience === f} onSelect={() => set("founderExperience", f)} title={FOUNDER_EXPERIENCE_LABELS[f]} />
                ))}
              </div>
              <Field label="Equity expectations" htmlFor="equity" optional hint="e.g. “Equal split for a full-time cofounder” — shared only on your profile.">
                <Input id="equity" value={d.equityExpectation} onChange={(e) => set("equityExpectation", e.target.value)} maxLength={200} />
              </Field>
            </div>
          ),
          payload: () => ({ step: "profile", patch: { founderExperience: d.founderExperience, equityExpectation: d.equityExpectation } }),
        },
      );
    }

    list.push({
      key: "looking-for",
      title: "What are you looking for right now?",
      subtitle: "In your own words. This appears on your profile and helps You&Me AI find the right people.",
      optional: true,
      canContinue: true,
      body: (
        <Textarea
          aria-label="What you're looking for"
          value={d.lookingFor}
          onChange={(e) => set("lookingFor", e.target.value)}
          maxLength={500}
          placeholder={
            founderTrack
              ? "A technical cofounder who's excited about healthcare and wants to go full-time this year."
              : d.intents.includes("consult")
                ? "Early-stage teams who need help finding their first growth channel."
                : "An early-stage team in climate where I can own backend infrastructure."
          }
        />
      ),
      payload: () => ({ step: "profile", patch: { lookingFor: d.lookingFor } }),
    });
    return list;
  }, [d, building, founderTrack, skills, industries, categories]);

  const total = steps.length + 1;
  const [index, setIndex] = React.useState(() => Math.min(initial.stepIndex, steps.length));
  const current = steps[index];
  const isFinal = index >= steps.length;
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  async function next() {
    if (!current || saving) return;
    const payload = current.payload();
    setSaving(true);
    const res = await saveOnboardingStep({ ...(payload ?? { step: "progress" }), index } as OnboardingStepInput);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0 });
  }

  async function finish(to: "/quiz" | "/home") {
    setSaving(true);
    const res = await finishOnboarding();
    if (!res.ok) {
      setSaving(false);
      toast.error(res.error);
      return;
    }
    router.push(to);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4 sm:px-6">
          {index > 0 ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="Previous question">
              <ArrowLeft />
            </Button>
          ) : (
            <LogoMark className="size-6" />
          )}
          <Progress value={((index + 1) / total) * 100} label="Onboarding progress" className="flex-1" />
          <span className="w-14 text-right text-xs text-subtle tabular-nums">
            {Math.min(index + 1, total)} / {total}
          </span>
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-10 pb-32 sm:px-6 sm:pt-16">
        {!isFinal && current ? (
          <form
            key={current.key}
            className="animate-fade-up"
            onSubmit={(e) => {
              e.preventDefault();
              if (current.canContinue) void next();
            }}
          >
            {current.eyebrow && <p className="mb-3 text-[13px] font-medium text-brand-ink">{current.eyebrow}</p>}
            <h1 ref={headingRef} tabIndex={-1} className="text-[28px] leading-[1.15] font-semibold tracking-tight outline-none sm:text-[36px]">
              {current.title}
            </h1>
            {current.subtitle && <p className="mt-3 text-[15px] text-muted">{current.subtitle}</p>}
            <div className="mt-8">{current.body}</div>

            <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur-md safe-bottom sm:static sm:mt-10 sm:border-0 sm:bg-transparent sm:backdrop-blur-none">
              <div className="mx-auto flex max-w-2xl items-center justify-end gap-3 px-4 py-3 sm:px-0 sm:py-0">
                {current.optional && (
                  <Button type="button" variant="ghost" onClick={() => setIndex((i) => i + 1)} disabled={saving}>
                    Skip
                  </Button>
                )}
                <Button type="submit" size="lg" disabled={!current.canContinue} loading={saving} className="min-w-36">
                  Continue
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="animate-fade-up">
            <div className="mb-8 flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-white">
              <GraduationCap className="size-6" aria-hidden />
            </div>
            <p className="mb-3 text-[13px] font-medium text-brand-ink">One last thing</p>
            <h1 ref={headingRef} tabIndex={-1} className="text-[28px] leading-[1.15] font-semibold tracking-tight outline-none sm:text-[36px]">
              How do you like to build?
            </h1>
            <p className="mt-3 text-[15px] text-muted">
              Our 3-minute working-style quiz covers decisions, conflict, risk and pace. It&apos;s not a personality test — it helps us explain
              who you&apos;ll work well with, and where you might clash.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => finish("/quiz")} loading={saving}>
                Take the quiz
              </Button>
              <Button size="lg" variant="secondary" onClick={() => finish("/home")} disabled={saving}>
                Do it later
              </Button>
            </div>
            <p className={cn("mt-6 text-[13px] text-subtle")}>You can edit every answer from your profile at any time.</p>
          </div>
        )}
      </main>
    </div>
  );
}
