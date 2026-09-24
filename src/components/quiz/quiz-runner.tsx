"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { submitQuizAction } from "@/app/(app)/quiz/actions";
import { LIKERT_OPTIONS } from "@/lib/personality";
import { cn } from "@/lib/utils";

type Q = { id: string; key: string; prompt: string; topic: string };

/** One statement per screen; picking an answer advances automatically. Fully keyboard operable (1–5 keys). */
export function QuizRunner({ questions, initialAnswers }: { questions: Q[]; initialAnswers: Record<string, number> }) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<string, number>>(initialAnswers);
  const firstUnanswered = questions.findIndex((q) => answers[q.id] === undefined);
  const [index, setIndex] = React.useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [submitting, setSubmitting] = React.useState(false);
  const q = questions[index];
  const answeredCount = questions.filter((x) => answers[x.id] !== undefined).length;
  const complete = answeredCount === questions.length;

  const choose = React.useCallback(
    (value: number) => {
      if (!q) return;
      setAnswers((a) => ({ ...a, [q.id]: value }));
      if (index < questions.length - 1) setTimeout(() => setIndex((i) => i + 1), 180);
    },
    [q, index, questions.length],
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) choose(n);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose]);

  async function submit() {
    setSubmitting(true);
    const res = await submitQuizAction(answers);
    if (!res.ok) {
      setSubmitting(false);
      toast.error(res.error);
      return;
    }
    router.push("/working-style?completed=1");
  }

  if (!q) return null;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10 flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label="Previous statement">
          <ArrowLeft />
        </Button>
        <Progress value={(answeredCount / questions.length) * 100} label="Quiz progress" className="flex-1" />
        <span className="text-xs text-subtle tabular-nums">
          {index + 1} / {questions.length}
        </span>
      </div>

      <div key={q.id} className="animate-fade-up">
        <p className="mb-3 text-[13px] font-medium text-brand-ink">{q.topic}</p>
        <h1 className="text-[26px] leading-snug font-semibold tracking-tight sm:text-[32px]">“{q.prompt}”</h1>
        <div className="mt-10 grid gap-2.5 sm:grid-cols-5" role="radiogroup" aria-label="How much do you agree?">
          {LIKERT_OPTIONS.map((o) => {
            const selected = answers[q.id] === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left text-sm font-medium transition-all active:scale-[0.98] sm:flex-col sm:justify-center sm:gap-2 sm:px-2 sm:py-5 sm:text-center",
                  selected ? "border-foreground bg-ink text-ink-foreground" : "border-border bg-card hover:border-border-strong",
                )}
              >
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums", selected ? "border-ink-foreground/40" : "border-border-strong text-subtle")}>
                  {o.value}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-12 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <p className="text-[13px] text-subtle">This describes how you like to work. It&apos;s not a clinical or psychological assessment.</p>
        <Button size="lg" onClick={submit} disabled={!complete} loading={submitting}>
          {complete ? "See my working style" : `${questions.length - answeredCount} to go`}
        </Button>
      </div>
    </div>
  );
}
