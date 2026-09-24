"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const DIMS = [
  { key: "expertise", label: "Expertise", hint: "Did they know their stuff?" },
  { key: "communication", label: "Communication", hint: "Clear, responsive, easy to work with?" },
  { key: "value", label: "Value", hint: "Worth what you paid?" },
  { key: "reliability", label: "Reliability", hint: "On time, did what they said?" },
] as const;
type Dim = (typeof DIMS)[number]["key"];

export function ReviewForm({
  bookingId,
  consultantName,
  submit,
}: {
  bookingId: string;
  consultantName: string;
  submit: (raw: { bookingId: string; expertise: number; communication: number; value: number; reliability: number; body?: string }) => Promise<Result<unknown>>;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<Dim, number>>({ expertise: 0, communication: 0, value: 0, reliability: 0 });
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const complete = Object.values(scores).every((v) => v > 0);
  const overall = complete ? Math.round((scores.expertise + scores.communication + scores.value + scores.reliability) / 4) : null;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!complete) return void toast.error("Rate all four areas first.");
        start(async () => {
          const res = await submit({ bookingId, ...scores, body: body.trim() || undefined });
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Thanks — your review helps founders find ${consultantName.split(" ")[0]}.`);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {DIMS.map((d) => (
          <fieldset key={d.key}>
            <legend className="text-[13px] font-medium">{d.label}</legend>
            <p className="text-xs text-muted">{d.hint}</p>
            <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label={d.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={scores[d.key] === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onClick={() => setScores((s) => ({ ...s, [d.key]: n }))}
                  className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Star className={cn("size-6", n <= scores[d.key] ? "fill-current text-warning" : "text-border-strong")} />
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <Field label="Anything other founders should know?" htmlFor="review-body" optional>
        <Textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} placeholder="What did you work on? What changed afterwards?" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">{overall ? `Overall: ${overall} / 5` : "Overall is the average of the four ratings."}</p>
        <Button type="submit" loading={pending} disabled={!complete}>
          Post review
        </Button>
      </div>
    </form>
  );
}
