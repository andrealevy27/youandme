import { Check, Sparkles } from "lucide-react";
import { MockAvatar, MockRing } from "@/components/marketing/hero-mockup";
import s from "@/components/marketing/marketing.module.css";
import { cn } from "@/lib/utils";

/** Calm right-hand panel for auth pages (desktop only). Purely decorative + illustrative. */
export function AuthBrandPanel() {
  return (
    <div className="sticky hidden overflow-hidden rounded-[28px] border border-border bg-surface top-3 lg:flex lg:h-[calc(100dvh-1.5rem)] lg:min-h-[640px] lg:flex-col lg:justify-between">
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", s.grid)} />
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", s.glow)} />

      <div className="relative px-12 pt-14">
        <p className="text-[13px] font-medium text-brand-ink">The network for building startups</p>
        <p className="mt-4 max-w-md text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          Fewer introductions. <span className="text-gradient">Better matches.</span>
        </p>
      </div>

      <div aria-hidden className="relative mx-12 mb-14 max-w-md">
        <div className="rounded-[20px] border border-border bg-card p-5 shadow-float">
          <div className="flex items-center gap-3">
            <MockAvatar name="Maya R" hue={252} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold tracking-tight">Maya R.</p>
              <p className="text-[12.5px] text-muted">Product engineer · Full-time</p>
            </div>
            <MockRing score={87} size={48} stroke={4} />
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-foreground/85">
            Strong match because your skill sets are highly complementary and you share similar long-term ambitions.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Commitment", "Vision", "Communication"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11.5px] font-medium text-success">
                <Check className="size-3" strokeWidth={3} />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className={cn("-mt-3 ml-auto w-[260px] translate-x-6 rounded-[16px] border border-border bg-elevated p-3.5 shadow-float", s.float)}>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-gradient text-white">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-[12px] font-semibold">You&amp;Me AI</span>
          </div>
          <p className="mt-2 text-[12.5px] leading-snug text-muted">Five people worth meeting are ready for you today.</p>
        </div>
        <p className="mt-6 text-[11.5px] text-subtle">Illustrative preview.</p>
      </div>
    </div>
  );
}
