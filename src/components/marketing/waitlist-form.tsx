"use client";
import * as React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { joinWaitlistAction } from "@/app/(marketing)/waitlist/actions";
import { cn } from "@/lib/utils";
import { WAITLIST_INTENTS, WAITLIST_SOURCES } from "./waitlist-intents";

export function WaitlistForm() {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [school, setSchool] = React.useState("");
  const [source, setSource] = React.useState("");
  const [sourceDetail, setSourceDetail] = React.useState("");
  const [intent, setIntent] = React.useState<string>("");
  const [note, setNote] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setPending(true);
    const res = await joinWaitlistAction({
      email,
      name,
      phone: phone || undefined,
      school: school || undefined,
      source: source || undefined,
      sourceDetail: source === "other" ? sourceDetail || undefined : undefined,
      intent: intent || undefined,
      note: note || undefined,
      website: website || undefined,
    }).catch(() => null);
    setPending(false);
    if (!res) return setFormError("We couldn't reach You&Me. Check your connection and try again.");
    if (!res.ok) {
      const fe = Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""]));
      setErrors(fe);
      if (!Object.keys(fe).length) setFormError(res.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center" role="status">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h2 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.03em]">You&apos;re on the list.</h2>
        <p className="mx-auto mt-3 max-w-sm text-[15.5px] leading-relaxed text-muted">
          Thanks, {name.trim().split(" ")[0] || "friend"}. We&apos;re letting people in carefully — we&apos;ll email{" "}
          <span className="font-medium text-foreground">{email.trim()}</span> when your spot opens.
        </p>
        <Button asChild variant="secondary" size="lg" className="mt-8 h-11">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor="wl-website">Website</label>
        <input id="wl-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="wl-name" error={errors.name}>
          <Input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} aria-invalid={!!errors.name || undefined} />
        </Field>
        <Field label="Email" htmlFor="wl-email" error={errors.email}>
          <Input
            id="wl-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={!!errors.email || undefined}
          />
        </Field>
        <Field label="Phone" htmlFor="wl-phone" optional error={errors.phone}>
          <Input
            id="wl-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            maxLength={20}
            aria-invalid={!!errors.phone || undefined}
          />
        </Field>
        <Field label="School" htmlFor="wl-school" optional error={errors.school}>
          <Input
            id="wl-school"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            autoComplete="organization"
            maxLength={120}
            placeholder="e.g. NYU"
            aria-invalid={!!errors.school || undefined}
          />
        </Field>
      </div>
      <Field label="How did you hear about us?" htmlFor="wl-source" optional error={errors.source}>
        <NativeSelect id="wl-source" value={source} onChange={(e) => setSource(e.target.value)} aria-invalid={!!errors.source || undefined}>
          <option value="">Choose one</option>
          {WAITLIST_SOURCES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {source === "other" && (
        <Field label="Where exactly?" htmlFor="wl-source-detail" optional error={errors.sourceDetail}>
          <Input id="wl-source-detail" value={sourceDetail} onChange={(e) => setSourceDetail(e.target.value)} maxLength={120} />
        </Field>
      )}
      <fieldset>
        <legend className="text-[13px] font-medium">
          What brings you to You&amp;Me?<span className="ml-1.5 font-normal text-subtle">Optional</span>
        </legend>
        <div role="radiogroup" className="mt-2 grid gap-2 sm:grid-cols-2">
          {WAITLIST_INTENTS.map((i) => (
            <button
              key={i.value}
              type="button"
              role="radio"
              aria-checked={intent === i.value}
              onClick={() => setIntent(intent === i.value ? "" : i.value)}
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-[10px] border px-3.5 text-left text-[14px] transition-colors",
                intent === i.value ? "border-foreground bg-card ring-1 ring-foreground" : "border-border-strong bg-card hover:border-foreground/40",
              )}
            >
              <span
                aria-hidden
                className={cn("size-3.5 shrink-0 rounded-full border", intent === i.value ? "border-[4.5px] border-foreground" : "border-border-strong")}
              />
              {i.label}
            </button>
          ))}
        </div>
        {errors.intent && (
          <p className="mt-1.5 text-[13px] text-danger" role="alert">
            {errors.intent}
          </p>
        )}
      </fieldset>
      <Field label="Anything we should know?" htmlFor="wl-note" optional error={errors.note} hint="What you're building, or who you're hoping to meet.">
        <Textarea id="wl-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
      </Field>
      {formError && (
        <p role="alert" className="rounded-[10px] border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 w-full" loading={pending}>
        Join the waitlist
      </Button>
      <p className="text-center text-[12.5px] text-subtle">
        We&apos;ll only use your email to let you in. See our{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
