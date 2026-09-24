"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Bookmark, Check, GraduationCap, Heart, MapPin, MessageCircle, Sparkles, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScoreRing } from "@/components/ui/progress";
import { interestedAction, passAction, recommendationViewedAction, saveAction } from "@/app/(app)/matches/actions";
import { AVAILABILITY_LABELS, COMMITMENT_LABELS, STAGE_LABELS, type StartupStage } from "@/lib/domain";
import type { DailyRecommendation } from "@/server/recommendations";
import { cn } from "@/lib/utils";

type Action = DailyRecommendation["action"];

export function RecommendationCard({ rec, compact = false }: { rec: DailyRecommendation; compact?: boolean }) {
  const router = useRouter();
  const [action, setAction] = React.useState<Action>(rec.action);
  const [busy, setBusy] = React.useState<Action | null>(null);
  const [match, setMatch] = React.useState<{ conversationId: string | null } | null>(null);
  const ref = React.useRef<HTMLElement>(null);
  const p = rec.person;
  const first = p.name.split(" ")[0];

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void recommendationViewedAction(rec.id);
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rec.id]);

  async function act(kind: "passed" | "saved" | "interested") {
    setBusy(kind);
    const res = kind === "interested" ? await interestedAction(p.userId) : kind === "passed" ? await passAction(p.userId) : await saveAction(p.userId);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setAction(kind);
    if (kind === "interested" && "matched" in res.data && res.data.matched) {
      setMatch({ conversationId: res.data.conversationId ?? null });
    } else if (kind === "interested") {
      toast.success(`We'll let you know if ${first} is interested too.`);
    } else if (kind === "saved") {
      toast.success(`Saved ${first} for later.`);
    }
    router.refresh();
  }

  const commitment = p.commitment ? COMMITMENT_LABELS[p.commitment] : null;
  const availability = p.availability ? AVAILABILITY_LABELS[p.availability] : null;

  if (action === "passed") {
    return (
      <div className="flex items-center justify-between rounded-[16px] border border-dashed border-border-strong px-5 py-4 text-sm text-muted">
        <span>You passed on {p.name}. We won&apos;t show them again for a while.</span>
      </div>
    );
  }

  return (
    <article ref={ref} className="animate-fade-up overflow-hidden rounded-[20px] border border-border bg-card shadow-soft" aria-labelledby={`rec-${rec.id}`}>
      <div className="grid gap-0 md:grid-cols-[280px_1fr]">
        {/* Identity column */}
        <div className="relative flex flex-col items-center border-b border-border bg-surface/60 px-6 py-7 text-center md:border-r md:border-b-0">
          <Avatar name={p.name} src={p.avatarUrl} size="2xl" rounded="xl" />
          <h3 id={`rec-${rec.id}`} className="mt-4 text-lg font-semibold tracking-tight">
            <Link href={`/people/${p.handle}`} className="hover:underline">
              {p.name}
            </Link>
          </h3>
          {(p.currentRole || p.headline) && <p className="mt-0.5 text-sm text-muted">{p.currentRole ? `${p.currentRole}${p.currentCompany ? ` · ${p.currentCompany}` : ""}` : p.headline}</p>}
          <div className="mt-3 flex flex-col items-center gap-1.5 text-[13px] text-muted">
            {p.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden /> {p.location}
              </span>
            )}
            {p.university && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-3.5" aria-hidden /> {p.university}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {commitment && <Badge variant="outline">{commitment}</Badge>}
            {availability && <Badge variant="outline">{availability}</Badge>}
            {p.isDemo && <DemoBadge />}
          </div>
        </div>

        {/* Reasoning column */}
        <div className="flex flex-col p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <ScoreRing score={rec.score} size={60} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-brand-ink">{rec.score}% compatibility</p>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground">{rec.explanation}</p>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-[12px] bg-brand-soft/60 px-4 py-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
            <p>
              <span className="font-medium">Why {first}: </span>
              <span className="text-muted">{rec.reason}</span>
            </p>
          </div>

          {!compact && p.bio && <p className="mt-5 line-clamp-3 text-sm leading-relaxed text-muted">{p.bio}</p>}

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            {rec.strengths.length > 0 && (
              <div>
                <dt className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Strong alignment</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {rec.strengths.slice(0, 4).map((f) => (
                    <Badge key={f.key} variant="success">
                      <Check /> {f.label}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
            {p.complementarySkills.length > 0 && (
              <div>
                <dt className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Complementary skills</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {p.complementarySkills.slice(0, 4).map((s) => (
                    <Badge key={s} variant="brand">
                      {s}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
            {p.sharedInterests.length > 0 && (
              <div>
                <dt className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Shared interests</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {p.sharedInterests.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </dd>
              </div>
            )}
            {p.stagePreferences.length > 0 && !compact && (
              <div>
                <dt className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Stages</dt>
                <dd className="text-muted">{p.stagePreferences.map((s) => STAGE_LABELS[s as StartupStage]).join(" · ")}</dd>
              </div>
            )}
          </dl>

          {rec.frictions.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Potential friction</p>
              <ul className="space-y-1.5">
                {rec.frictions.slice(0, compact ? 1 : 3).map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                    <span>
                      <span className="font-medium text-foreground">{f.title}.</span> {f.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
            {action === "interested" ? (
              <Badge variant="brand" size="md">
                <Heart /> You&apos;re interested
              </Badge>
            ) : (
              <>
                <Button variant="secondary" onClick={() => act("passed")} loading={busy === "passed"} disabled={!!busy} aria-label={`Pass on ${p.name}`}>
                  <X /> Pass
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => act("saved")}
                  loading={busy === "saved"}
                  disabled={!!busy || action === "saved"}
                  aria-label={`Save ${p.name}`}
                >
                  <Bookmark className={cn(action === "saved" && "fill-current")} /> {action === "saved" ? "Saved" : "Save"}
                </Button>
                <Button onClick={() => act("interested")} loading={busy === "interested"} disabled={!!busy}>
                  <Heart /> Interested
                </Button>
              </>
            )}
            <Button variant="ghost" asChild className="ml-auto">
              <Link href={`/people/${p.handle}`}>View full profile</Link>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!match} onOpenChange={(o) => !o && setMatch(null)}>
        <DialogContent title={`You and ${first} matched`} description="You're both interested in building together.">
          <div className="flex items-center justify-center gap-3 py-4">
            <Avatar name={p.name} src={p.avatarUrl} size="xl" />
          </div>
          <p className="text-center text-sm text-muted">Start with what you&apos;re building and why you think you&apos;d work well together.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setMatch(null)}>
              Keep browsing
            </Button>
            {match?.conversationId && (
              <Button asChild>
                <Link href={`/messages/${match.conversationId}`}>
                  <MessageCircle /> Send a message
                </Link>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
