"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarOff, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Result } from "./types";

type Rule = { weekday: number; startMinute: number; endMinute: number };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMinute = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function AvailabilityEditor({ initial, save }: { initial: Rule[]; save: (raw: { rules: Rule[] }) => Promise<Result> }) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);

  const byDay = (d: number) => rules.map((r, i) => ({ r, i })).filter(({ r }) => r.weekday === d);
  const update = (i: number, patch: Partial<Rule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <ul className="flex flex-col divide-y divide-border rounded-[14px] border border-border">
        {ORDER.map((d) => {
          const ranges = byDay(d);
          const on = ranges.length > 0;
          return (
            <li key={d} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start">
              <label className="flex w-40 shrink-0 items-center gap-3 pt-1.5 text-sm font-medium">
                <Switch
                  checked={on}
                  aria-label={`Available on ${DAYS[d]}`}
                  onCheckedChange={(c) =>
                    setRules((rs) => (c ? [...rs, { weekday: d, startMinute: 9 * 60, endMinute: 17 * 60 }] : rs.filter((r) => r.weekday !== d)))
                  }
                />
                {DAYS[d]}
              </label>
              {on ? (
                <div className="flex flex-1 flex-col gap-2">
                  {ranges.map(({ r, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" step={900} aria-label={`${DAYS[d]} start`} className="h-10 w-32" value={toTime(r.startMinute)} onChange={(e) => update(i, { startMinute: toMinute(e.target.value) })} />
                      <span className="text-muted">–</span>
                      <Input
                        type="time"
                        step={900}
                        aria-label={`${DAYS[d]} end`}
                        className="h-10 w-32"
                        value={toTime(Math.min(r.endMinute, 1439))}
                        onChange={(e) => update(i, { endMinute: toMinute(e.target.value) || 1440 })}
                      />
                      <Button variant="ghost" size="icon-sm" aria-label="Remove range" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}>
                        <X />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="link"
                    size="sm"
                    className="self-start text-[13px]"
                    onClick={() => {
                      const last = ranges[ranges.length - 1]?.r;
                      const start = Math.min(last ? last.endMinute + 60 : 9 * 60, 22 * 60);
                      setRules((rs) => [...rs, { weekday: d, startMinute: start, endMinute: Math.min(start + 120, 1440) }]);
                    }}
                  >
                    <Plus /> Add hours
                  </Button>
                </div>
              ) : (
                <p className="pt-2 text-sm text-subtle">Unavailable</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <Button
          loading={pending}
          disabled={!dirty}
          onClick={() =>
            start(async () => {
              const res = await save({ rules });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Availability saved");
              router.refresh();
            })
          }
        >
          Save weekly hours
        </Button>
        {dirty && <span className="text-[13px] text-muted">Unsaved changes</span>}
      </div>
    </div>
  );
}

export function SchedulingSettings({
  timezone,
  minNoticeHours,
  timezones,
  save,
}: {
  timezone: string;
  minNoticeHours: number;
  timezones: string[];
  save: (raw: { timezone: string; minNoticeHours: number }) => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const res = await save({ timezone: String(f.get("timezone")), minNoticeHours: Number(f.get("minNotice")) });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Scheduling settings saved");
          router.refresh();
        });
      }}
    >
      <Field label="Your timezone" htmlFor="sched-tz" hint="Weekly hours are in this timezone.">
        <NativeSelect id="sched-tz" name="timezone" defaultValue={timezone}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Minimum notice" htmlFor="sched-notice" hint="How far ahead founders must book.">
        <NativeSelect id="sched-notice" name="minNotice" defaultValue={String(minNoticeHours)}>
          {[0, 2, 4, 12, 24, 48, 72, 168].map((h) => (
            <option key={h} value={h}>
              {h === 0 ? "No minimum" : h < 24 ? `${h} hours` : h === 168 ? "1 week" : `${h / 24} day${h === 24 ? "" : "s"}`}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" variant="secondary" loading={pending} className="sm:mb-[22px]">
        Save
      </Button>
    </form>
  );
}

export function TimeOffManager({
  items,
  add,
  remove,
}: {
  items: { id: string; day: string }[];
  add: (raw: { day: string }) => Promise<Result>;
  remove: (raw: { id: string }) => Promise<Result>;
}) {
  const router = useRouter();
  const [day, setDay] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(msg);
      setDay("");
      router.refresh();
    });
  return (
    <div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (day) run(() => add({ day }), "Day off added");
        }}
      >
        <Field label="Add a day off" htmlFor="timeoff-day" className="flex-1 sm:max-w-56">
          <Input id="timeoff-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </Field>
        <Button type="submit" variant="secondary" loading={pending}>
          Add
        </Button>
      </form>
      {items.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((t) => (
            <li key={t.id} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong bg-card pr-1 pl-3 text-[13px]">
              <CalendarOff className="size-3.5 text-muted" aria-hidden />
              {new Date(`${t.day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
              <button type="button" className="rounded-full p-1 text-muted hover:bg-surface hover:text-foreground" aria-label={`Remove ${t.day}`} onClick={() => run(() => remove({ id: t.id }), "Day off removed")}>
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-muted">No upcoming days off.</p>
      )}
    </div>
  );
}
