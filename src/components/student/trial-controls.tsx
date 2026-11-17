"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkInAction, setChecklistItemAction, startTrialAction } from "@/app/(app)/trials/actions";
import { cn } from "@/lib/utils";

export function StartTrialButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={async () => {
        setPending(true);
        const res = await startTrialAction(matchId);
        if (!res.ok) {
          setPending(false);
          return void toast.error(res.error);
        }
        router.push(`/trials/${res.data.id}`);
      }}
    >
      <FlaskConical /> Start a 2-week trial
    </Button>
  );
}

export function ChecklistItem({
  trialId,
  itemKey,
  title,
  prompt,
  initialDone,
  disabled,
}: {
  trialId: string;
  itemKey: string;
  title: string;
  prompt: string;
  initialDone: boolean;
  disabled: boolean;
}) {
  const [done, setDone] = React.useState(initialDone);
  const [pending, setPending] = React.useState(false);
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        disabled={disabled || pending}
        onClick={async () => {
          const next = !done;
          setDone(next);
          setPending(true);
          const res = await setChecklistItemAction(trialId, itemKey, next);
          setPending(false);
          if (!res.ok) {
            setDone(!next);
            toast.error(res.error);
          }
        }}
        className="flex w-full items-start gap-3 rounded-[14px] border border-border bg-card p-4 text-left transition-colors hover:border-border-strong disabled:cursor-default disabled:hover:border-border"
      >
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border",
            done ? "border-brand bg-brand text-brand-foreground" : "border-border-strong",
          )}
        >
          {done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
        </span>
        <span>
          <span className={cn("block text-[15px] font-medium", done && "text-muted line-through decoration-1")}>{title}</span>
          <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{prompt}</span>
        </span>
      </button>
    </li>
  );
}

export function CheckInButtons({ trialId, mine }: { trialId: string; mine: "continue" | "stop" | null }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"continue" | "stop" | null>(null);
  async function go(d: "continue" | "stop") {
    setPending(d);
    const res = await checkInAction(trialId, d);
    setPending(null);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }
  if (mine) {
    return (
      <p className="text-[14px] text-muted">
        You said <span className="font-medium text-foreground">{mine === "continue" ? "continue" : "stop"}</span>. Waiting for their check-in.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button onClick={() => go("continue")} loading={pending === "continue"} disabled={!!pending}>
        Continue as cofounders
      </Button>
      <Button variant="secondary" onClick={() => go("stop")} loading={pending === "stop"} disabled={!!pending}>
        Stop here
      </Button>
    </div>
  );
}
