import * as React from "react";
import { Info } from "lucide-react";

export type LegalSectionDef = { id: string; title: string; body: React.ReactNode };

/** Readable legal document layout: title, template callout, sticky table of contents, numbered sections. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: React.ReactNode; sections: LegalSectionDef[] }) {
  return (
    <div className="px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="text-[13px] font-medium text-brand-ink">Legal</p>
          <h1 className="mt-3 text-[38px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[52px]">{title}</h1>
          <p className="mt-3 text-[14px] text-subtle">Last updated {updated}</p>
          <div className="mt-8 flex gap-3 rounded-[14px] border border-warning/25 bg-warning-soft px-4 py-3.5 text-[13.5px] leading-relaxed text-warning">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">Template — review with counsel before launch.</span> This document describes how You&amp;Me is designed to
              work, but it has not yet been reviewed by a lawyer and is not final legal advice.
            </p>
          </div>
          <div className="mt-8 space-y-4 text-[16.5px] leading-[1.7] text-foreground/85">{intro}</div>
        </header>

        <div className="mt-14 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[12px] font-medium tracking-wide text-subtle uppercase">On this page</p>
              <ol className="mt-3 space-y-2 border-l border-border text-[13.5px]">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="-ml-px block border-l border-transparent pl-4 text-muted transition-colors hover:border-foreground hover:text-foreground">
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
          <div className="max-w-3xl space-y-14">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="flex items-baseline gap-3 text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-[24px]">
                  <span className="font-mono text-[14px] font-normal text-subtle">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <div className="legal-body mt-4 space-y-4 text-[15.5px] leading-[1.75] text-foreground/85 [&_a]:font-medium [&_a]:text-brand-ink [&_a]:underline-offset-4 hover:[&_a]:underline [&_h3]:mt-6 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-subtle">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
