"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/badge";
import { interestedAction } from "@/app/(app)/matches/actions";

export type IntroCardData = {
  person: { userId: string; handle: string; name: string; avatarUrl: string | null; headline: string | null; university: string | null; isDemo: boolean };
  reason: string;
  status: "none" | "interested" | "matched";
  conversationId: string | null;
};

/** One "person to meet": who, one plain reason, and a single next step. */
export function IntroCard({ intro, rank, readOnly = false }: { intro: IntroCardData; rank: number; readOnly?: boolean }) {
  const [status, setStatus] = React.useState(intro.status);
  const [conversationId, setConversationId] = React.useState(intro.conversationId);
  const [pending, setPending] = React.useState(false);
  const p = intro.person;

  async function meet() {
    setPending(true);
    const res = await interestedAction(p.userId);
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    if (res.data.matched) {
      setStatus("matched");
      setConversationId(res.data.conversationId ?? null);
      toast.success(`It's a match — you and ${p.name.split(" ")[0]} both want to talk.`);
    } else {
      setStatus("interested");
      toast.success(`Saved. If ${p.name.split(" ")[0]} says yes too, you'll match.`);
    }
  }

  return (
    <li className="rounded-[18px] border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-start gap-3.5">
        <div className="relative">
          <Avatar name={p.name} src={p.avatarUrl} size="lg" />
          <span className="absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-ink-foreground tabular-nums">
            {rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {readOnly ? (
              <p className="text-[16px] font-semibold tracking-tight">{p.name}</p>
            ) : (
              <Link href={`/people/${p.handle}`} className="text-[16px] font-semibold tracking-tight hover:underline">
                {p.name}
              </Link>
            )}
            {p.isDemo && <DemoBadge />}
          </div>
          <p className="truncate text-[13px] text-subtle">{[p.headline, p.university].filter(Boolean).join(" · ")}</p>
          <p className="mt-2.5 flex gap-2 text-[14.5px] leading-snug">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
            <span>{intro.reason}</span>
          </p>
        </div>
      </div>
      {!readOnly && (
        <div className="mt-4 flex justify-end">
          {status === "matched" ? (
            <Button asChild size="sm">
              <Link href={conversationId ? `/messages/${conversationId}` : "/messages"}>
                <MessageCircle /> Message
              </Link>
            </Button>
          ) : status === "interested" ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
              <Check className="size-4 text-success" aria-hidden /> You said yes — waiting on {p.name.split(" ")[0]}
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={meet} loading={pending}>
              I&apos;d like to build with them
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
