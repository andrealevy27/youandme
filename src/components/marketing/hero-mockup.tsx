import { Check, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import s from "./marketing.module.css";

/** Deterministic, obviously-illustrative avatar (initials on a tinted gradient). */
export function MockAvatar({ name, hue, size = 40, className }: { name: string; hue: number; size?: number; className?: string }) {
  const letters = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, size < 32 ? 1 : 2)
    .map((p) => p[0])
    .join("");
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-card", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.36),
        background: `linear-gradient(135deg, hsl(${hue} 52% 46%), hsl(${(hue + 36) % 360} 58% 34%))`,
      }}
    >
      {letters}
    </span>
  );
}

export function MockRing({ score, size = 64, stroke = 5, animated = true }: { score: number; size?: number; stroke?: number; animated?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`mr-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-surface" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          stroke={`url(#mr-${size})`}
          className={cn("fill-none", animated && s.ring)}
          style={{ ["--ring-c" as string]: c }}
        />
      </svg>
      <span className="absolute font-semibold tracking-tight tabular-nums" style={{ fontSize: size * 0.3 }}>
        {score}
      </span>
    </span>
  );
}

const five = [
  { name: "Maya R.", role: "Product engineer", score: 87, hue: 252 },
  { name: "Dev K.", role: "Growth lead", score: 81, hue: 18 },
  { name: "Ana L.", role: "ML researcher", score: 78, hue: 160 },
  { name: "Sam O.", role: "Ops & finance", score: 74, hue: 205 },
  { name: "Priya N.", role: "Designer", score: 72, hue: 320 },
];

/**
 * Illustrative product preview for the hero. Pure HTML/CSS/SVG — no images,
 * no real people, no real numbers. Marked aria-hidden with a text caption.
 */
export function HeroMockup() {
  return (
    <figure className="relative mx-auto w-full max-w-[560px]">
      <div aria-hidden className="relative lg:mr-20">
        {/* Main recommendation card */}
        <div className="relative z-10 overflow-hidden rounded-[22px] border border-border bg-card shadow-float">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand" />
              <span className="text-[13px] font-medium">Five people worth meeting</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={cn("h-1.5 rounded-full", i === 0 ? "w-4 bg-foreground" : "w-1.5 bg-border-strong")} />
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <MockAvatar name="Maya R" hue={252} size={52} />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold tracking-tight">Maya R.</p>
                <p className="mt-0.5 truncate text-[13px] text-muted">Product engineer · Fintech · Full-time</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">Seeking business cofounder</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">Remote-friendly</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <MockRing score={87} size={60} />
                <span className="text-[10px] font-medium tracking-wide text-subtle uppercase">Match</span>
              </div>
            </div>

            <p className="mt-5 text-[14px] leading-relaxed text-foreground/90">
              Strong match because your skill sets are highly complementary, both of you want to build full-time, and you share similar long-term
              ambitions.
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {["Commitment", "Vision", "Communication"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-medium text-success">
                  <Check className="size-3" strokeWidth={3} />
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-warning-soft lg:inline-flex px-3 py-2 text-[12.5px] text-warning">
              <TriangleAlert className="size-3.5 shrink-0" />
              <span>
                <span className="font-medium">Worth discussing:</span> different decision-making styles
              </span>
            </div>

            <div className="mt-5 grid grid-cols-[auto_1fr] gap-2 lg:flex">
              <span className="inline-flex h-10 items-center justify-center rounded-[10px] border border-border-strong px-4 text-[13px] font-medium">Pass</span>
              <span className="inline-flex h-10 items-center justify-center rounded-[10px] bg-ink px-5 text-[13px] font-medium text-ink-foreground">
                I&apos;m interested
              </span>
            </div>
          </div>
        </div>

        {/* AI concierge bubble */}
        <div className={cn("relative z-30 mr-3 -mt-5 ml-auto w-[248px] lg:absolute lg:-bottom-[104px] lg:-left-10 lg:m-0", s.float)}>
          <div className="rounded-[16px] border border-border bg-elevated p-3.5 shadow-float">
            <div className="flex items-center gap-2">
              <span className={cn("flex size-6 items-center justify-center rounded-full bg-brand-gradient text-white", s.pulse)}>
                <Sparkles className="size-3.5" />
              </span>
              <span className="text-[12px] font-semibold">You&amp;Me AI</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-muted">
              Maya has shipped two payments products. Want a suggested first conversation topic?
            </p>
          </div>
        </div>
        {/* Phone: today's five */}
        <div className={cn("absolute top-[68%] -right-24 z-20 hidden w-[196px] lg:block", s.floatSlow)}>
          <div className="rounded-[30px] border border-border-strong bg-elevated p-2 shadow-float">
            <div className="rounded-[23px] border border-border bg-background px-3 pt-2 pb-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" />
              <p className="text-[11px] font-medium text-subtle">Today</p>
              <p className="mb-2 text-[13px] font-semibold tracking-tight">Your five</p>
              <ul className="space-y-1.5">
                {five.map((p, i) => (
                  <li key={p.name} className={cn("flex items-center gap-2 rounded-[10px] px-1.5 py-1.5", i === 0 && "bg-card ring-1 ring-border")}>
                    <MockAvatar name={p.name} hue={p.hue} size={22} className="ring-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium">{p.name}</span>
                      <span className="block truncate text-[9.5px] text-subtle">{p.role}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-brand-ink tabular-nums">{p.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      </div>
      <figcaption className="mt-6 text-center text-[12px] text-subtle lg:mt-36 lg:text-left">Illustrative preview — names and scores are examples.</figcaption>
    </figure>
  );
}
