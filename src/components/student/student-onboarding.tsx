"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, GraduationCap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, OptionCard } from "@/components/ui/chip";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { LogoMark } from "@/components/shell/logo";
import { StudentPrivacyNote } from "./privacy-note";
import { finishStudentOnboardingAction, saveStudentStepAction, type StudentStepInput } from "@/app/onboarding/actions";
import { COFOUNDER_TYPES, COFOUNDER_TYPE_LABELS, SKILL_CATEGORY_LABELS, type CofounderType, type SkillCategory } from "@/lib/domain";
import { LIKERT_OPTIONS } from "@/lib/personality";
import { CLASS_YEARS, IDEA_STATUSES, SUMMER_PLANS, WEEKLY_HOURS } from "@/lib/student";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; category?: string };
type QuizItem = { key: string; prompt: string };

export type StudentDraft = {
  stepIndex: number;
  displayName: string;
  classYear: string;
  major: string;
  skillIds: string[];
  ideaStatus: string;
  ideaSummary: string;
  cofounderTypes: CofounderType[];
  lookingFor: string;
  industryIds: string[];
  weeklyHours: number | null;
  summerPlans: string;
  answers: Record<string, number>;
  visible: boolean;
  campusScope: "all" | "my_school";
};

type StepPayload = StudentStepInput extends infer U ? (U extends unknown ? Omit<U, "index"> : never) : never;
type Step = { key: string; title: string; subtitle?: string; canContinue: boolean; body: React.ReactNode; payload: () => StepPayload };

function toggle<T>(list: T[], item: T, max = Infinity) {
  return list.includes(item) ? list.filter((x) => x !== item) : list.length >= max ? list : [...list, item];
}

/** Compact skill picker: search + grouped chips, max 6. */
function SkillPicker({ skills, selected, onChange, max }: { skills: Option[]; selected: string[]; onChange: (ids: string[]) => void; max: number }) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const groups = new Map<string, Option[]>();
  for (const s of skills) {
    if (q && !s.name.toLowerCase().includes(q)) continue;
    groups.set(s.category ?? "other", [...(groups.get(s.category ?? "other") ?? []), s]);
  }
  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" className="pl-10" aria-label="Search skills" />
      </div>
      <p className="mb-4 text-[13px] text-muted" aria-live="polite">
        {selected.length} of {max} selected
      </p>
      <div className="space-y-4">
        {[...groups.entries()].map(([cat, items]) => (
          <div key={cat}>
            <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">{SKILL_CATEGORY_LABELS[cat as SkillCategory] ?? cat}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((s) => (
                <Chip key={s.id} size="sm" selected={selected.includes(s.id)} onToggle={() => onChange(toggle(selected, s.id, max))}>
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentOnboardingFlow({
  initial,
  school,
  skills,
  industries,
  quiz,
  next: nextHref,
}: {
  initial: StudentDraft;
  school: { name: string; verified: boolean } | null;
  skills: Option[];
  industries: Option[];
  quiz: QuizItem[];
  /** Where to go when done (e.g. back to an event page). */
  next: string;
}) {
  const router = useRouter();
  const [d, setD] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof StudentDraft>(k: K, v: StudentDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const steps: Step[] = [
    {
      key: "about",
      title: "Let's start with the basics",
      subtitle: "This is how other students will see you.",
      canContinue: !!d.displayName.trim() && !!d.classYear && !!d.major.trim(),
      body: (
        <div className="space-y-6">
          {school && (
            <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium">
              <GraduationCap className="size-4 text-brand-ink" aria-hidden />
              {school.name}
              {school.verified && <BadgeCheck className="size-4 text-brand-ink" aria-label="Verified" />}
            </p>
          )}
          <Field label="Your name" htmlFor="name">
            <Input id="name" value={d.displayName} onChange={(e) => set("displayName", e.target.value)} autoComplete="name" maxLength={80} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Year</legend>
            <div className="flex flex-wrap gap-2">
              {CLASS_YEARS.map((y) => (
                <Chip key={y.key} size="sm" selected={d.classYear === y.key} onToggle={() => set("classYear", y.key)}>
                  {y.label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Field label="Major" htmlFor="major">
            <Input id="major" value={d.major} onChange={(e) => set("major", e.target.value)} placeholder="e.g. Computer Science, or Undeclared" maxLength={80} />
          </Field>
        </div>
      ),
      payload: () => ({ step: "about", data: { displayName: d.displayName, classYear: d.classYear as never, major: d.major } }),
    },
    {
      key: "skills",
      title: "What are you good at?",
      subtitle: "Up to 6. Class projects, clubs and side projects all count.",
      canContinue: d.skillIds.length > 0,
      body: <SkillPicker skills={skills} selected={d.skillIds} onChange={(ids) => set("skillIds", ids)} max={6} />,
      payload: () => ({ step: "skills", skillIds: d.skillIds }),
    },
    {
      key: "idea",
      title: "Do you have an idea?",
      canContinue: !!d.ideaStatus,
      body: (
        <div className="space-y-5">
          <div className="grid gap-2.5" role="radiogroup" aria-label="Idea">
            {IDEA_STATUSES.map((o) => (
              <OptionCard key={o.key} selected={d.ideaStatus === o.key} title={o.label} description={o.hint} onSelect={() => set("ideaStatus", o.key)} />
            ))}
          </div>
          {(d.ideaStatus === "have_idea" || d.ideaStatus === "open") && (
            <Field label="Your idea in one line (optional)" htmlFor="idea">
              <Textarea id="idea" rows={2} maxLength={200} value={d.ideaSummary} onChange={(e) => set("ideaSummary", e.target.value)} placeholder="e.g. A marketplace for used lab equipment between universities" />
            </Field>
          )}
        </div>
      ),
      payload: () => ({ step: "idea", data: { ideaStatus: d.ideaStatus as never, ideaSummary: d.ideaSummary } }),
    },
    {
      key: "looking_for",
      title: "Who are you looking for?",
      subtitle: "Pick up to 3. We'll introduce you to people who cover them.",
      canContinue: d.cofounderTypes.length > 0,
      body: (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {COFOUNDER_TYPES.map((t) => (
              <Chip key={t} selected={d.cofounderTypes.includes(t)} onToggle={() => set("cofounderTypes", toggle(d.cofounderTypes, t, 3))}>
                {COFOUNDER_TYPE_LABELS[t]}
              </Chip>
            ))}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Spaces you care about (optional, up to 3)</legend>
            <div className="flex flex-wrap gap-2">
              {industries.map((i) => (
                <Chip key={i.id} size="sm" selected={d.industryIds.includes(i.id)} onToggle={() => set("industryIds", toggle(d.industryIds, i.id, 3))}>
                  {i.name}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Field label="Anything else? (optional)" htmlFor="lf">
            <Textarea id="lf" rows={2} maxLength={280} value={d.lookingFor} onChange={(e) => set("lookingFor", e.target.value)} placeholder="e.g. Someone who's shipped a mobile app and wants to work on health" />
          </Field>
        </div>
      ),
      payload: () => ({ step: "looking_for", data: { cofounderTypes: d.cofounderTypes, lookingFor: d.lookingFor }, industryIds: d.industryIds }),
    },
    {
      key: "time",
      title: "How much time can you really give?",
      subtitle: "Be honest — matching on time commitment avoids most early breakups.",
      canContinue: d.weeklyHours !== null && !!d.summerPlans,
      body: (
        <div className="space-y-7">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Per week, alongside classes</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {WEEKLY_HOURS.map((h) => (
                <OptionCard key={h.key} selected={d.weeklyHours === Number(h.key)} title={h.label} description={h.hint} onSelect={() => set("weeklyHours", Number(h.key))} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">This summer</legend>
            <div className="flex flex-wrap gap-2">
              {SUMMER_PLANS.map((p) => (
                <Chip key={p.key} size="sm" selected={d.summerPlans === p.key} onToggle={() => set("summerPlans", p.key)}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>
      ),
      payload: () => ({ step: "time", data: { weeklyHours: d.weeklyHours ?? 0, summerPlans: d.summerPlans as never } }),
    },
    {
      key: "quiz",
      title: "How do you like to work?",
      subtitle: "Seven quick statements. No wrong answers — it helps us explain who you'll work well with.",
      canContinue: quiz.every((q) => d.answers[q.key] !== undefined),
      body: (
        <ol className="space-y-6">
          {quiz.map((q, i) => (
            <li key={q.key}>
              <p id={`q-${q.key}`} className="text-[15px] font-medium">
                {i + 1}. {q.prompt}
              </p>
              <div role="radiogroup" aria-labelledby={`q-${q.key}`} className="mt-2.5 grid grid-cols-5 gap-1.5">
                {LIKERT_OPTIONS.map((o) => {
                  const on = d.answers[q.key] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={o.label}
                      title={o.label}
                      onClick={() => set("answers", { ...d.answers, [q.key]: o.value })}
                      className={cn(
                        "h-10 rounded-[10px] border text-[13px] font-medium transition-colors",
                        on ? "border-foreground bg-ink text-ink-foreground" : "border-border bg-card text-muted hover:border-border-strong",
                      )}
                    >
                      {o.value}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[11.5px] text-subtle">
                <span>Disagree</span>
                <span>Agree</span>
              </div>
            </li>
          ))}
        </ol>
      ),
      payload: () => ({ step: "quiz", answers: d.answers }),
    },
  ];

  const total = steps.length + 1;
  const [index, setIndex] = React.useState(() => Math.min(initial.stepIndex, steps.length));
  const current = steps[index];
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => headingRef.current?.focus(), [index]);

  async function next() {
    if (!current || saving) return;
    setSaving(true);
    const res = await saveStudentStepAction({ ...current.payload(), index } as StudentStepInput);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    setSaving(true);
    const res = await finishStudentOnboardingAction({ visible: d.visible, campusScope: d.campusScope });
    if (!res.ok) {
      setSaving(false);
      return void toast.error(res.error);
    }
    router.push(nextHref);
    router.refresh();
  }

  const footer = (label: string, disabled: boolean) => (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur-md safe-bottom sm:static sm:mt-10 sm:border-0 sm:bg-transparent sm:backdrop-blur-none">
      <div className="mx-auto flex max-w-xl justify-end px-4 py-3 sm:px-0 sm:py-0">
        <Button type="submit" size="lg" disabled={disabled} loading={saving} className="w-full sm:w-auto sm:min-w-36">
          {label}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-4 px-4 sm:px-6">
          {index > 0 ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="Previous question">
              <ArrowLeft />
            </Button>
          ) : (
            <LogoMark className="size-6" />
          )}
          <Progress value={((index + 1) / total) * 100} label="Onboarding progress" className="flex-1" />
          <span className="w-12 text-right text-xs text-subtle tabular-nums">
            {Math.min(index + 1, total)} / {total}
          </span>
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-8 pb-32 sm:px-6 sm:pt-14">
        {current ? (
          <form
            key={current.key}
            onSubmit={(e) => {
              e.preventDefault();
              if (current.canContinue) void next();
            }}
          >
            {/* The footer must sit outside the animated element: a transform turns position:fixed into position:absolute. */}
            <div className="animate-fade-up">
            <h1 ref={headingRef} tabIndex={-1} className="text-[26px] leading-[1.15] font-semibold tracking-tight outline-none sm:text-[34px]">
              {current.title}
            </h1>
            {current.subtitle && <p className="mt-2.5 text-[15px] text-muted">{current.subtitle}</p>}
            <div className="mt-7">{current.body}</div>
            </div>
            {footer("Continue", !current.canContinue)}
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void finish();
            }}
          >
            <div className="animate-fade-up">
            <h1 ref={headingRef} tabIndex={-1} className="text-[26px] leading-[1.15] font-semibold tracking-tight outline-none sm:text-[34px]">
              Who can see you?
            </h1>
            <p className="mt-2.5 text-[15px] text-muted">You can change this any time in Settings.</p>
            <div className="mt-7 space-y-5">
              <label className="flex items-start justify-between gap-4 rounded-[14px] border border-border bg-card p-4">
                <span>
                  <span className="block text-[15px] font-medium">Show my profile to verified students</span>
                  <span className="mt-0.5 block text-[13px] text-muted">Needed to get introductions and appear at events.</span>
                </span>
                <Switch checked={d.visible} onCheckedChange={(v) => set("visible", v)} aria-label="Show my profile to verified students" />
              </label>
              <div className="grid gap-2.5" role="radiogroup" aria-label="Which campuses">
                <OptionCard
                  selected={d.campusScope === "all"}
                  title="Open to other campuses"
                  description="Meet student founders at every school on FoundMate."
                  onSelect={() => set("campusScope", "all")}
                />
                <OptionCard
                  selected={d.campusScope === "my_school"}
                  title={`${school?.name ?? "My school"} only`}
                  description="Only see, and be seen by, students at your school."
                  onSelect={() => set("campusScope", "my_school")}
                />
              </div>
              <StudentPrivacyNote />
            </div>
            </div>
            {footer("Finish", false)}
          </form>
        )}
      </main>
    </div>
  );
}
