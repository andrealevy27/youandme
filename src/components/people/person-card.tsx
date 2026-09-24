import * as React from "react";
import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { VERIFICATION_LABELS, type VerificationType } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { PersonSummary } from "@/server/people";

/** Strongest check first — a badge only ever claims what was actually verified. */
const VERIFICATION_ORDER: VerificationType[] = ["identity", "linkedin", "university_email", "phone", "email"];

export function strongestVerification(verified: string[]): VerificationType | null {
  return VERIFICATION_ORDER.find((v) => verified.includes(v)) ?? null;
}

/**
 * Reusable person card for search results, suggestions and AI results.
 * Works in server and client trees (no hooks). The name links to /people/[handle];
 * pass `action` for a CTA and `reason` for a short "why this person" line.
 */
export function PersonCard({
  person,
  reason,
  action,
  className,
}: {
  person: PersonSummary;
  reason?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const verification = strongestVerification(person.verified);
  const role = [person.currentRole, person.currentCompany].filter(Boolean).join(" at ");
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-[16px] border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-float",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={person.name} src={person.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              <Link href={`/people/${person.handle}`} className="after:absolute after:inset-0 after:rounded-[16px] focus-visible:outline-none">
                {person.name}
              </Link>
            </h3>
            {person.isDemo && <DemoBadge />}
          </div>
          {person.headline && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{person.headline}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-subtle">
            {role && <span className="truncate">{role}</span>}
            {person.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {person.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {(person.lookingForCofounder || verification) && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {person.lookingForCofounder && <Badge variant="brand">Looking for a cofounder</Badge>}
          {verification && (
            <Badge variant="success" title={person.verified.map((v) => VERIFICATION_LABELS[v as VerificationType] ?? v).join(" · ")}>
              <BadgeCheck aria-hidden />
              {VERIFICATION_LABELS[verification]}
            </Badge>
          )}
        </div>
      )}

      {person.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Top skills">
          {person.skills.slice(0, 4).map((s) => (
            <li key={s}>
              <Badge>{s}</Badge>
            </li>
          ))}
        </ul>
      )}

      {reason && <p className="mt-3 text-[13px] leading-relaxed text-foreground/80">{reason}</p>}

      {action && <div className="relative z-10 mt-auto flex flex-wrap gap-2 pt-4">{action}</div>}
    </article>
  );
}
