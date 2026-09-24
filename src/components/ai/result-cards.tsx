"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartupLogo } from "@/components/discover/startup-card";
import { startDirectConversationAction } from "@/app/(app)/messages/actions";
import { STAGE_LABELS } from "@/lib/domain";
import { formatMoney } from "@/lib/utils";
import type { ConciergeCard } from "@/server/ai/types";

const PRICE_SUFFIX: Record<string, string> = { hourly: "/hr", recurring: "/mo" };

function CardShell({ children }: { children: React.ReactNode }) {
  return <li className="flex min-w-0 flex-col rounded-[14px] border border-border bg-card p-4 shadow-soft">{children}</li>;
}

function MessageButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const res = await startDirectConversationAction(userId);
        setBusy(false);
        if (!res.ok) return void toast.error(res.error);
        router.push(`/messages/${res.data.conversationId}`);
      }}
      aria-label={`Message ${name}`}
    >
      <MessageCircle /> Message
    </Button>
  );
}

/** Result cards under an assistant message. Only ever built from tool-returned ids. */
export function ResultCards({ cards }: { cards: ConciergeCard[] }) {
  if (!cards.length) return null;
  return (
    <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Results">
      {cards.map((c) => {
        if (c.kind === "person") {
          return (
            <CardShell key={`p-${c.userId}`}>
              <div className="flex items-start gap-3">
                <Avatar name={c.name} src={c.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/people/${c.handle}`} className="truncate text-sm font-semibold hover:underline">
                      {c.name}
                    </Link>
                    {c.isDemo && <DemoBadge />}
                  </div>
                  {c.headline && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{c.headline}</p>}
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {c.lookingForCofounder && <Badge variant="brand">Looking for a cofounder</Badge>}
                {c.skills.slice(0, 2).map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
              <div className="mt-auto flex gap-2 pt-3">
                <Button asChild size="sm">
                  <Link href={`/people/${c.handle}`}>View</Link>
                </Button>
                <MessageButton userId={c.userId} name={c.name} />
              </div>
            </CardShell>
          );
        }
        if (c.kind === "consultant") {
          return (
            <CardShell key={`c-${c.userId}`}>
              <div className="flex items-start gap-3">
                <Avatar name={c.name} src={c.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/consultants/${c.handle}`} className="truncate text-sm font-semibold hover:underline">
                      {c.name}
                    </Link>
                    <Badge variant="outline">Consultant</Badge>
                    {c.isDemo && <DemoBadge />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{c.headline}</p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                {c.fromPriceCents != null && (
                  <span className="font-medium">
                    From {formatMoney(c.fromPriceCents, c.currency)}
                    {PRICE_SUFFIX[c.fromPricingType ?? ""] ?? ""}
                  </span>
                )}
                {c.ratingAvg != null && c.reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Star className="size-3.5 fill-current text-warning" aria-hidden />
                    {c.ratingAvg.toFixed(1)} ({c.reviewCount})
                  </span>
                )}
                {c.categories.slice(0, 2).map((cat) => (
                  <Badge key={cat}>{cat}</Badge>
                ))}
              </div>
              <div className="mt-auto flex gap-2 pt-3">
                <Button asChild size="sm">
                  <Link href={`/consultants/${c.handle}`}>View services</Link>
                </Button>
              </div>
            </CardShell>
          );
        }
        return (
          <CardShell key={`s-${c.startupId}`}>
            <div className="flex items-start gap-3">
              <StartupLogo name={c.name} logoUrl={c.logoUrl} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/startups/${c.slug}`} className="truncate text-sm font-semibold hover:underline">
                    {c.name}
                  </Link>
                  {c.isDemo && <DemoBadge />}
                </div>
                {c.tagline && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{c.tagline}</p>}
              </div>
            </div>
            <div className="mt-2.5">
              <Badge variant="outline">{STAGE_LABELS[c.stage]}</Badge>
            </div>
            <div className="mt-auto flex gap-2 pt-3">
              <Button asChild size="sm">
                <Link href={`/startups/${c.slug}`}>View</Link>
              </Button>
            </div>
          </CardShell>
        );
      })}
    </ul>
  );
}
