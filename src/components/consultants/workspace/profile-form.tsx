"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { STAGE_LABELS, STARTUP_STAGES, type StartupStage } from "@/lib/domain";
import type { Result } from "./types";

export type ProfileFormValues = {
  headline: string;
  bio: string;
  yearsExperience: number | null;
  hourlyRateCents: number | null;
  languages: string[];
  previousCompanies: string[];
  stagesServed: StartupStage[];
  categorySlugs: string[];
  remoteAvailable: boolean;
  acceptingClients: boolean;
};

const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function ConsultantProfileForm({
  initial,
  categories,
  submitLabel,
  onSubmit,
  successMessage,
}: {
  initial: ProfileFormValues;
  categories: { slug: string; name: string }[];
  submitLabel: string;
  successMessage: string;
  onSubmit: (v: ProfileFormValues) => Promise<Result>;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [languages, setLanguages] = useState(initial.languages.join(", "));
  const [companies, setCompanies] = useState(initial.previousCompanies.join(", "));
  const [rate, setRate] = useState(initial.hourlyRateCents ? String(initial.hourlyRateCents / 100) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const set = <K extends keyof ProfileFormValues>(k: K, val: ProfileFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const toggle = <T extends string>(list: T[], item: T, max = 99) => (list.includes(item) ? list.filter((x) => x !== item) : list.length >= max ? list : [...list, item]);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const payload: ProfileFormValues = {
          ...v,
          languages: splitList(languages),
          previousCompanies: splitList(companies),
          hourlyRateCents: rate ? Math.round(Number(rate) * 100) : null,
        };
        start(async () => {
          const res = await onSubmit(payload);
          if (!res.ok) {
            const fe = (res as { fieldErrors?: Record<string, string[]> }).fieldErrors;
            setErrors(Object.fromEntries(Object.entries(fe ?? {}).map(([k, m]) => [k, m[0] ?? ""])));
            return void toast.error(res.error);
          }
          setErrors({});
          toast.success(successMessage);
          router.refresh();
        });
      }}
    >
      <Field label="Headline" htmlFor="cp-headline" hint="What you help founders do, in one line." error={errors.headline}>
        <Input id="cp-headline" value={v.headline} onChange={(e) => set("headline", e.target.value)} maxLength={120} placeholder="TikTok & creator-led growth for consumer startups" required />
      </Field>
      <Field label="About" htmlFor="cp-bio" optional error={errors.bio}>
        <Textarea id="cp-bio" value={v.bio} onChange={(e) => set("bio", e.target.value)} maxLength={3000} rows={5} placeholder="Your background, the kinds of problems you solve and how you like to work." />
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium">Areas of expertise</legend>
        <p className="mb-2 text-[13px] text-muted">Pick up to 5.</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Chip key={c.slug} size="sm" selected={v.categorySlugs.includes(c.slug)} onToggle={() => set("categorySlugs", toggle(v.categorySlugs, c.slug, 5))}>
              {c.name}
            </Chip>
          ))}
        </div>
        {errors.categorySlugs && <p className="mt-1.5 text-[13px] text-danger">{errors.categorySlugs}</p>}
      </fieldset>
      <fieldset>
        <legend className="text-[13px] font-medium">Stages you work with</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {STARTUP_STAGES.map((s) => (
            <Chip key={s} size="sm" selected={v.stagesServed.includes(s)} onToggle={() => set("stagesServed", toggle(v.stagesServed, s))}>
              {STAGE_LABELS[s]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Languages" htmlFor="cp-languages" hint="Comma-separated" error={errors.languages}>
          <Input id="cp-languages" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Spanish" />
        </Field>
        <Field label="Previous companies" htmlFor="cp-companies" hint="Comma-separated" optional>
          <Input id="cp-companies" value={companies} onChange={(e) => setCompanies(e.target.value)} placeholder="Stripe, Notion" />
        </Field>
        <Field label="Years of experience" htmlFor="cp-years" optional>
          <Input id="cp-years" type="number" min={0} max={60} value={v.yearsExperience ?? ""} onChange={(e) => set("yearsExperience", e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label="Typical hourly rate (USD)" htmlFor="cp-rate" optional hint="Shown only if you have no services yet.">
          <Input id="cp-rate" type="number" min={0} step={1} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="200" />
        </Field>
      </div>
      <div className="flex flex-col gap-3 rounded-[14px] border border-border p-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-medium">Available remotely</span>
            <span className="text-[13px] text-muted">Work with founders anywhere.</span>
          </span>
          <Switch checked={v.remoteAvailable} onCheckedChange={(c) => set("remoteAvailable", c)} aria-label="Available remotely" />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-medium">Accepting new clients</span>
            <span className="text-[13px] text-muted">Turn off to pause new bookings. Existing ones aren&apos;t affected.</span>
          </span>
          <Switch checked={v.acceptingClients} onCheckedChange={(c) => set("acceptingClients", c)} aria-label="Accepting new clients" />
        </label>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
