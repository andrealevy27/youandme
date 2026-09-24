"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CalendarX2, Check, Clock, FlaskConical, Lock, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn, formatMoney } from "@/lib/utils";
import { formatDuration, formatServicePrice, formatSlotDay, formatSlotTime, localDayKey, pricingNote, timezoneLabel } from "@/components/consultants/format";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type StepperService = {
  id: string;
  title: string;
  description: string;
  pricingType: "fixed" | "hourly" | "package" | "recurring";
  priceCents: number;
  currency: string;
  billingInterval: string | null;
  durationMinutes: number;
  feeCents: number;
};

export type StepperStartup = { id: string; name: string; teammates: { userId: string; name: string; avatarUrl: string | null; role: string; title: string | null }[] };

const STEPS = ["Service", "Time", "Context", "Team", "Payment"] as const;

export function BookingStepper(props: {
  consultant: { id: string; name: string; handle: string; avatarUrl: string | null };
  services: StepperService[];
  initialServiceId: string;
  initialSlots: { hasRules: boolean; slots: string[] };
  viewerTimezone: string;
  startups: StepperStartup[];
  testMode: boolean;
  feePercentLabel: string;
  actions: {
    getSlots: (raw: { serviceId: string }) => Promise<Result<{ hasRules: boolean; slots: string[] }>>;
    book: (raw: {
      serviceId: string;
      startsAt: string;
      projectContext?: string;
      startupId?: string | null;
      teammateIds: string[];
      groupChat: boolean;
    }) => Promise<Result<{ bookingId: string; redirectUrl: string; external: boolean }>>;
  };
}) {
  const { consultant, services, viewerTimezone: tz, startups, actions } = props;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(props.initialServiceId);
  const [slotsByService, setSlotsByService] = useState<Record<string, { hasRules: boolean; slots: string[] }>>({ [props.initialServiceId]: props.initialSlots });
  const [loadingSlots, startSlots] = useTransition();
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [startupId, setStartupId] = useState<string>(startups.length === 1 ? startups[0]!.id : "");
  const [teammateIds, setTeammateIds] = useState<string[]>([]);
  const [groupChat, setGroupChat] = useState(true);
  const [paying, startPay] = useTransition();

  const service = services.find((s) => s.id === serviceId) ?? services[0]!;
  const slotData = slotsByService[service.id];
  const startup = startups.find((s) => s.id === startupId) ?? null;

  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slotData?.slots ?? []) {
      const k = localDayKey(s, tz);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()];
  }, [slotData, tz]);
  const activeDay = day && days.some(([d]) => d === day) ? day : (days[0]?.[0] ?? null);
  const daySlots = days.find(([d]) => d === activeDay)?.[1] ?? [];

  function chooseService(id: string) {
    setServiceId(id);
    setStartsAt(null);
    setDay(null);
    if (!slotsByService[id]) {
      startSlots(async () => {
        const res = await actions.getSlots({ serviceId: id });
        if (!res.ok) return void toast.error(res.error);
        setSlotsByService((m) => ({ ...m, [id]: res.data }));
      });
    }
    window.history.replaceState(null, "", `/consultants/${consultant.handle}/book/${id}`);
  }

  function pay() {
    if (!startsAt) return;
    startPay(async () => {
      const res = await actions.book({
        serviceId: service.id,
        startsAt,
        projectContext: context.trim() || undefined,
        startupId: startupId || null,
        teammateIds: startupId ? teammateIds : [],
        groupChat,
      });
      if (!res.ok) {
        toast.error(res.error);
        if (/taken|no longer available/i.test(res.error)) {
          // Refresh times and send them back to pick another.
          const fresh = await actions.getSlots({ serviceId: service.id });
          if (fresh.ok) setSlotsByService((m) => ({ ...m, [service.id]: fresh.data }));
          setStartsAt(null);
          setStep(1);
        }
        return;
      }
      if (res.data.external) window.location.href = res.data.redirectUrl;
      else router.push(res.data.redirectUrl);
    });
  }

  const canNext = [true, !!startsAt, true, true, false][step];
  const total = service.priceCents;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <ol className="mb-6 flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Booking steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
                  i === step ? "bg-ink text-ink-foreground" : i < step ? "bg-brand-soft text-brand-ink hover:brightness-95" : "bg-surface text-subtle",
                )}
              >
                {i < step ? <Check className="size-3.5" aria-hidden /> : <span className="tabular-nums">{i + 1}</span>}
                {label}
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-3 bg-border-strong" aria-hidden />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <StepShell title="Choose a service" description={`What would you like to work on with ${consultant.name.split(" ")[0]}?`}>
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Service">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === service.id}
                  onClick={() => chooseService(s.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-4 rounded-[14px] border bg-card p-4 text-left transition-all",
                    s.id === service.id ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">{s.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{s.description}</span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-subtle">
                      <Clock className="size-3" aria-hidden /> {formatDuration(s.durationMinutes)} · {pricingNote(s.pricingType, s.billingInterval)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatServicePrice(s.priceCents, s.currency, s.pricingType, s.billingInterval)}</span>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="Pick a time" description={`Times shown in ${timezoneLabel(tz)}.`}>
            {loadingSlots || !slotData ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-11 animate-pulse rounded-[10px] bg-surface" />
                ))}
              </div>
            ) : days.length === 0 ? (
              <EmptyState
                icon={<CalendarX2 />}
                title={slotData.hasRules ? "No open times in the next 3 weeks" : "No availability published yet"}
                description={`${consultant.name.split(" ")[0]} ${slotData.hasRules ? "is fully booked right now" : "hasn't set their weekly hours"}. Send them a message to find a time that works.`}
                action={
                  <Button variant="secondary" onClick={() => router.push(`/consultants/${consultant.handle}`)}>
                    Back to profile
                  </Button>
                }
              />
            ) : (
              <div>
                <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Day">
                  {days.map(([d, slots]) => {
                    const active = d === activeDay;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setDay(d)}
                        className={cn(
                          "flex w-[72px] shrink-0 flex-col items-center rounded-[14px] border py-2.5 transition-all",
                          active ? "border-foreground bg-ink text-ink-foreground" : "border-border bg-card hover:border-border-strong",
                        )}
                      >
                        <span className={cn("text-[11px] font-medium uppercase", active ? "opacity-80" : "text-subtle")}>{formatSlotDay(slots[0]!, tz, { weekday: "short" })}</span>
                        <span className="text-lg font-semibold tabular-nums">{formatSlotDay(slots[0]!, tz, { day: "numeric" })}</span>
                        <span className={cn("text-[11px]", active ? "opacity-80" : "text-subtle")}>{formatSlotDay(slots[0]!, tz, { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Start time">
                  {daySlots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={startsAt === s}
                      onClick={() => setStartsAt(s)}
                      className={cn(
                        "h-11 rounded-[10px] border text-sm font-medium tabular-nums transition-all",
                        startsAt === s ? "border-brand bg-brand text-brand-foreground" : "border-border-strong bg-card hover:border-foreground/50",
                      )}
                    >
                      {formatSlotTime(s, tz)}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-subtle">{formatDuration(service.durationMinutes)} session. Slots update live — if one is taken while you book, we&apos;ll let you pick again.</p>
              </div>
            )}
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="Share some context" description="A few lines help the consultant prepare. Only they (and anyone you add) will see this.">
            <div className="flex flex-col gap-4">
              <Field label="What do you want to get out of this session?" htmlFor="context" optional hint={`${context.length}/4000`}>
                <Textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  maxLength={4000}
                  rows={6}
                  placeholder="e.g. We launched two months ago, have 2,000 signups and want a repeatable TikTok playbook before our seed raise."
                />
              </Field>
              {startups.length > 0 && (
                <Field label="Booking for a startup?" htmlFor="startup" optional hint="Lets you add teammates in the next step.">
                  <NativeSelect
                    id="startup"
                    value={startupId}
                    onChange={(e) => {
                      setStartupId(e.target.value);
                      setTeammateIds([]);
                    }}
                  >
                    <option value="">Just me</option>
                    {startups.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="Invite your team" description="Add teammates who should join the session.">
            {!startup ? (
              <EmptyState
                icon={<Users />}
                title={startups.length ? "Booking just for you" : "No startup team yet"}
                description={startups.length ? "Choose a startup in the previous step to add teammates." : "Once you create or join a startup, you can bring teammates to sessions."}
              />
            ) : startup.teammates.length === 0 ? (
              <EmptyState icon={<Users />} title="No teammates yet" description={`Invite people to ${startup.name} to bring them into sessions.`} />
            ) : (
              <div className="flex flex-col gap-4">
                <ul className="flex flex-col divide-y divide-border rounded-[14px] border border-border bg-card">
                  {startup.teammates.map((t) => {
                    const checked = teammateIds.includes(t.userId);
                    return (
                      <li key={t.userId}>
                        <label className="flex cursor-pointer items-center gap-3 p-3.5">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--brand)]"
                            checked={checked}
                            onChange={() => setTeammateIds((ids) => (checked ? ids.filter((i) => i !== t.userId) : [...ids, t.userId]))}
                          />
                          <Avatar name={t.name} src={t.avatarUrl} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{t.name}</span>
                            <span className="block text-xs text-muted capitalize">{t.title ?? t.role}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-start justify-between gap-4 rounded-[14px] border border-border bg-card p-4">
                  <label htmlFor="groupChat" className="min-w-0">
                    <span className="block text-sm font-medium">Create a group chat with everyone</span>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {teammateIds.length ? `You, ${consultant.name.split(" ")[0]} and ${teammateIds.length} teammate${teammateIds.length === 1 ? "" : "s"}.` : "Select teammates to enable."} Otherwise you&apos;ll chat 1:1 with the consultant.
                    </span>
                  </label>
                  <Switch id="groupChat" checked={groupChat && teammateIds.length > 0} disabled={!teammateIds.length} onCheckedChange={setGroupChat} />
                </div>
              </div>
            )}
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="Review & pay" description={props.testMode ? "Check the details, then confirm." : "You'll confirm payment on Stripe's secure checkout."}>
            {props.testMode && (
              <div className="mb-4 flex items-start gap-2.5 rounded-[14px] border border-warning/30 bg-warning-soft p-4 text-sm text-warning" role="note">
                <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  <strong>Test mode — no money moves.</strong> This environment uses test payments; the booking is confirmed without a real charge.
                </p>
              </div>
            )}
            <Card className="divide-y divide-border">
              <SummaryRow label="Service" value={service.title} />
              <SummaryRow
                label="When"
                value={startsAt ? `${formatSlotDay(startsAt, tz, { weekday: "long", month: "long", day: "numeric" })}, ${formatSlotTime(startsAt, tz)}` : "—"}
                hint={formatDuration(service.durationMinutes)}
              />
              {startup && <SummaryRow label="For" value={startup.name} hint={teammateIds.length ? `+ ${teammateIds.length} teammate${teammateIds.length === 1 ? "" : "s"}` : undefined} />}
              <div className="flex flex-col gap-2 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Price</span>
                  <span className="tabular-nums">{formatServicePrice(service.priceCents, service.currency, service.pricingType, service.billingInterval)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted">You&amp;Me platform fee ({props.feePercentLabel}, included)</span>
                  <span className="text-muted tabular-nums">{formatMoney(service.feeCents, service.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Total{service.pricingType === "recurring" ? ` per ${service.billingInterval ?? "month"}` : ""}</span>
                  <span className="tabular-nums">{formatMoney(total, service.currency)}</span>
                </div>
              </div>
            </Card>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-subtle">
              <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
              {props.testMode
                ? "Test payment — nothing is charged."
                : "Payment is handled securely by Stripe; You&Me never sees your card details."}{" "}
              Free cancellation up to 24 hours before the session.
            </p>
            <Button size="lg" className="mt-5 w-full" onClick={pay} loading={paying} disabled={!startsAt}>
              {props.testMode ? "Confirm test booking" : `Pay ${formatMoney(total, service.currency)}`}
            </Button>
          </StepShell>
        )}

        {step < 4 && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft /> Back
            </Button>
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue <ArrowRight />
            </Button>
          </div>
        )}
        {step === 4 && (
          <Button variant="ghost" className="mt-3" onClick={() => setStep(3)}>
            <ArrowLeft /> Back
          </Button>
        )}
      </div>

      <aside className="order-first lg:order-none">
        <Card className="p-5 lg:sticky lg:top-8">
          <div className="flex items-center gap-3">
            <Avatar name={consultant.name} src={consultant.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{consultant.name}</p>
              <p className="truncate text-[13px] text-muted">{service.title}</p>
            </div>
          </div>
          <dl className="mt-4 flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Price</dt>
              <dd className="font-medium tabular-nums">{formatServicePrice(service.priceCents, service.currency, service.pricingType, service.billingInterval)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Length</dt>
              <dd>{formatDuration(service.durationMinutes)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Time</dt>
              <dd className="text-right">{startsAt ? `${formatSlotDay(startsAt, tz)}, ${formatSlotTime(startsAt, tz)}` : "Not picked yet"}</dd>
            </div>
          </dl>
        </Card>
      </aside>
    </div>
  );
}

function StepShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="animate-fade-up" aria-live="polite">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 mb-5 text-sm text-muted">{description}</p>}
      {children}
    </section>
  );
}

function SummaryRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right">
        <span className="block font-medium">{value}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </div>
  );
}
