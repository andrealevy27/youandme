import * as React from "react";
import { cn } from "@/lib/utils";

export function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28", className)}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 text-[13px] font-medium text-brand-ink", className)}>
      <span className="h-px w-5 bg-current opacity-60" aria-hidden />
      {children}
    </p>
  );
}

export function SectionTitle({ children, className, as: Tag = "h2" }: { children: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return (
    <Tag className={cn("mt-4 text-[34px] leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-[48px] lg:text-[56px]", className)}>
      {children}
    </Tag>
  );
}

export function Lead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-5 max-w-xl text-[17px] leading-relaxed text-pretty text-muted sm:text-[18px]", className)}>{children}</p>;
}
