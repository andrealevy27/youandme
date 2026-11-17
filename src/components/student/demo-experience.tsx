"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Clock, Info, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WhyYouTwo } from "./why-you-two";
import type { DemoPerson, DemoPersona } from "@/server/student/demo";
import { cn } from "@/lib/utils";

type Tab = "tonight" | "discover";

export function DemoExperience({ personas }: { personas: DemoPersona[] }) {
  const [personaKey, setPersonaKey] = React.useState(personas[0]!.key);
  const [tab, setTab] = React.useState<Tab>("tonight");
  const [mySchoolOnly, setMySchoolOnly] = React.useState(false);
  const [open, setOpen] = React.useState<DemoPerson | null>(null);
  const persona = personas.find((p) => p.key === personaKey)!;
  const discover = persona.people.filter((p) => !mySchoolOnly || p.schoolSlug === persona.schoolSlug);
  const tonight = persona.people.slice(0, 5);

  return (
    <section className="px-4 pt-6 pb-20 sm:px-8 sm:pt-10">
      <div className="mx-auto max-w-3xl">
        <p role="note" className="flex items-start gap-2 rounded-[12px] border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>Demo with sample students</strong> — these aren&apos;t real people and nothing here is saved. The matching and the reasons are
            the real ones.
          </span>
        </p>

        <h1 className="mt-6 text-[30px] leading-tight font-semibold tracking-tight sm:text-[40px]">See how FoundMate introduces students</h1>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium text-muted">Pretend you&apos;re a student who says…</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {personas.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={p.key === personaKey}
                onClick={() => {
                  setPersonaKey(p.key);
                  setMySchoolOnly(false);
                }}
                className={cn(
                  "rounded-[14px] border p-3.5 text-left transition-colors",
                  p.key === personaKey ? "border-foreground bg-card shadow-soft" : "border-border bg-card/60 hover:border-border-strong",
                )}
              >
                <span className="block text-[15px] font-semibold">“{p.label}”</span>
                <span className="mt-1 block text-[13px] leading-snug text-muted">{p.summary}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <nav aria-label="Demo views" className="mt-7 flex gap-1 border-b border-border">
          {(
            [
              ["tonight", "At an event: your 5 tonight"],
              ["discover", "Discover"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                tab === key ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "tonight" ? (
          <div className="mt-5">
            <p className="text-[13px] font-medium text-brand-ink">Startup Team Hunt · sample event</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight">Your 5 people to meet tonight</h2>
            <ol className="mt-4 space-y-3">
              {tonight.map((p, i) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(p)} className="w-full rounded-[18px] border border-border bg-card p-4 text-left shadow-soft transition-colors hover:border-border-strong">
                    <div className="flex items-start gap-3.5">
                      <div className="relative">
                        <Avatar name={p.name} size="lg" />
                        <span className="absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-ink-foreground">{i + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-semibold tracking-tight">{p.name}</p>
                        <p className="truncate text-[13px] text-subtle">
                          {p.headline} · {p.school}
                        </p>
                        <p className="mt-2.5 flex gap-2 text-[14.5px] leading-snug">
                          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
                          <span>{p.oneLiner}</span>
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-center text-[13px] text-subtle">Tap anyone to see every reason — and what to talk about early.</p>
          </div>
        ) : (
          <div className="mt-5">
            <div role="group" aria-label="Campus" className="inline-flex rounded-full border border-border p-0.5">
              {[
                [false, "All campuses"],
                [true, `${persona.schoolShort} only`],
              ].map(([v, label]) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={mySchoolOnly === v}
                  onClick={() => setMySchoolOnly(v as boolean)}
                  className={cn("rounded-full px-3 py-1 text-[13px] font-medium", mySchoolOnly === v ? "bg-ink text-ink-foreground" : "text-muted hover:text-foreground")}
                >
                  {label as string}
                </button>
              ))}
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {discover.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(p)} className="flex h-full w-full flex-col rounded-[16px] border border-border bg-card p-4 text-left shadow-soft hover:border-border-strong">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-[13px] text-muted">
                          {p.headline} · {p.school}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.skills.map((s) => (
                        <Badge key={s} variant="brand">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
                      <Clock className="size-3.5" aria-hidden /> {p.hours} · {p.ideaLine}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12 rounded-[20px] border border-border bg-card p-6 text-center">
          <p className="text-[18px] font-semibold tracking-tight">Ready for the real thing?</p>
          <p className="mt-1 text-[14px] text-muted">Sign up with your school email — it takes about three minutes.</p>
          <Button asChild size="lg" className="mt-5 h-12 px-6">
            <Link href="/signup">
              Join with your school email <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent title={open.name} description={`${open.headline} · ${open.school} · sample student`}>
            <WhyYouTwo reasons={open.reasons} score={open.score} max={5} />
            {open.talkAboutEarly.length > 0 && (
              <div className="mt-5 rounded-[12px] border border-warning/25 bg-warning-soft/60 p-3.5">
                <p className="mb-1.5 text-xs font-medium tracking-wide text-warning uppercase">Talk about early</p>
                <ul className="space-y-1.5">
                  {open.talkAboutEarly.map((t) => (
                    <li key={t} className="flex gap-2 text-[13.5px] text-muted">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-5 flex items-center gap-1.5 text-[13px] text-muted">
              <Check className="size-4 text-success" aria-hidden /> In the real app you&apos;d tap “I&apos;d like to build with them” — if they say yes too,
              you match and can message.
            </p>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
