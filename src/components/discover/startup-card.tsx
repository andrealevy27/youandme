import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { NEED_TYPE_LABELS, STAGE_LABELS, type NeedType } from "@/lib/domain";
import { cn, initials } from "@/lib/utils";
import type { StartupSummary } from "@/server/search";

export function StartupLogo({ name, logoUrl, size = 48 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="shrink-0 rounded-[12px] border border-border bg-surface object-cover"
        style={{ width: size, height: size }}
        unoptimized={logoUrl.startsWith("/uploads/")}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className="inline-flex shrink-0 items-center justify-center rounded-[12px] bg-ink font-semibold text-ink-foreground"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name) || "?"}
    </span>
  );
}

/** Startup result card: identity, stage, industries and what the team is looking for right now. */
export function StartupCard({ startup, className }: { startup: StartupSummary; className?: string }) {
  return (
    <article className={cn("relative flex h-full flex-col rounded-[16px] border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-float", className)}>
      <div className="flex items-start gap-3.5">
        <StartupLogo name={startup.name} logoUrl={startup.logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              <Link href={`/startups/${startup.slug}`} className="after:absolute after:inset-0 after:rounded-[16px] focus-visible:outline-none">
                {startup.name}
              </Link>
            </h3>
            {startup.isDemo && <DemoBadge />}
          </div>
          {startup.tagline && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{startup.tagline}</p>}
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <Badge variant="outline">{STAGE_LABELS[startup.stage]}</Badge>
        {startup.industries.slice(0, 3).map((i) => (
          <Badge key={i}>{i}</Badge>
        ))}
        {startup.location && (
          <span className="inline-flex items-center gap-1 px-1 text-[13px] text-subtle">
            <MapPin className="size-3.5" aria-hidden />
            {startup.location}
          </span>
        )}
      </div>
      {startup.lookingFor.length > 0 && (
        <div className="mt-auto pt-4">
          <p className="text-xs font-medium text-subtle">Looking for</p>
          <ul className="mt-1.5 space-y-1 text-[13px]">
            {startup.lookingFor.slice(0, 3).map((n, idx) => (
              <li key={`${n.title}-${idx}`} className="flex gap-2">
                <span className="text-subtle">{n.type === "role" ? "Role" : NEED_TYPE_LABELS[n.type as NeedType]}</span>
                <span className="min-w-0 truncate font-medium">{n.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
