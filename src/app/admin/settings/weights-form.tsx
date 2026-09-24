"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AdminServerAction } from "@/components/admin/admin-action";
import { normaliseWeights } from "@/components/admin/normalise";

type Factor = { key: string; label: string };

/** Eight 0–100 sliders with a live preview of each factor's normalised share of the score. */
export function WeightsForm({
  factors,
  initial,
  defaults,
  action,
}: {
  factors: Factor[];
  initial: Record<string, number>;
  defaults: Record<string, number>;
  action: AdminServerAction;
}) {
  const keys = factors.map((f) => f.key);
  const router = useRouter();
  const [weights, setWeights] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const pct = normaliseWeights(keys, weights);
  const allZero = keys.every((k) => !weights[k]);
  const dirty = keys.some((k) => weights[k] !== initial[k]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await action(weights);
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Matching weights saved — new recommendations use them from the next daily run.");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <ul className="space-y-3.5">
        {factors.map(({ key: k, label }) => (
          <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[180px_1fr_64px_48px]">
            <label htmlFor={`w-${k}`} className="text-[13.5px] font-medium">
              {label}
            </label>
            <span className="text-right text-[13px] text-muted tabular-nums sm:order-last">{pct[k]}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={weights[k]}
              onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
              className="col-span-2 w-full accent-[var(--brand)] sm:col-span-1"
              aria-label={`${label} weight`}
            />
            <input
              id={`w-${k}`}
              type="number"
              min={0}
              max={100}
              value={weights[k]}
              onChange={(e) => {
                const n = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                setWeights((w) => ({ ...w, [k]: n }));
              }}
              className="hidden h-9 w-16 rounded-[10px] border border-border-strong bg-card px-2 text-right text-sm tabular-nums sm:block"
            />
          </li>
        ))}
      </ul>
      <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-surface" aria-hidden>
        {factors.filter((f) => (pct[f.key] ?? 0) > 0).map(({ key: k, label }, i) => (
          <span key={k} className="h-full border-r-2 border-card last:border-r-0" style={{ width: `${pct[k]}%`, background: "var(--brand)", opacity: 1 - i * 0.1 }} title={`${label} ${pct[k]}%`} />
        ))}
      </div>
      {allZero && <p className="mt-3 text-[13px] text-danger">At least one factor needs a weight above zero.</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setWeights(defaults)} disabled={pending}>
          Reset to defaults
        </Button>
        <Button type="submit" loading={pending} disabled={allZero || !dirty}>
          Save weights
        </Button>
      </div>
    </form>
  );
}
