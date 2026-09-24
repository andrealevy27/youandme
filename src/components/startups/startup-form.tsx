"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { createStartupAction, updateStartupAction } from "@/app/(app)/startups/actions";
import {
  BUSINESS_MODELS,
  BUSINESS_MODEL_LABELS,
  FUNDING_STATUSES,
  FUNDING_STATUS_LABELS,
  STAGE_LABELS,
  STARTUP_STAGES,
  VISIBILITY,
  WORK_MODES,
  WORK_MODE_LABELS,
} from "@/lib/domain";
import type { StartupInput } from "@/server/startups";

export type StartupFormValues = {
  name: string;
  tagline: string;
  description: string;
  problem: string;
  solution: string;
  stage: (typeof STARTUP_STAGES)[number];
  businessModel: string;
  foundedOn: string;
  location: string;
  workMode: string;
  websiteUrl: string;
  pitchDeckUrl: string;
  logoUrl: string;
  traction: string;
  fundingStatus: string;
  fundingRaised: string;
  teamSize: string;
  status: "active" | "paused" | "acquired" | "shut_down";
  visibility: (typeof VISIBILITY)[number];
  industryIds: string[];
};

export const EMPTY_STARTUP: StartupFormValues = {
  name: "",
  tagline: "",
  description: "",
  problem: "",
  solution: "",
  stage: "idea",
  businessModel: "",
  foundedOn: "",
  location: "",
  workMode: "",
  websiteUrl: "",
  pitchDeckUrl: "",
  logoUrl: "",
  traction: "",
  fundingStatus: "",
  fundingRaised: "",
  teamSize: "1",
  status: "active",
  visibility: "public",
  industryIds: [],
};

function toInput(v: StartupFormValues): StartupInput {
  return {
    name: v.name,
    tagline: v.tagline,
    description: v.description,
    problem: v.problem,
    solution: v.solution,
    stage: v.stage,
    businessModel: (v.businessModel || null) as StartupInput["businessModel"],
    foundedOn: v.foundedOn || null,
    location: v.location,
    workMode: (v.workMode || null) as StartupInput["workMode"],
    websiteUrl: v.websiteUrl,
    pitchDeckUrl: v.pitchDeckUrl,
    logoUrl: v.logoUrl || null,
    traction: v.traction,
    fundingStatus: (v.fundingStatus || null) as StartupInput["fundingStatus"],
    fundingRaisedCents: v.fundingRaised ? Math.round(Number(v.fundingRaised.replace(/[^0-9.]/g, "")) * 100) : null,
    teamSize: v.teamSize ? Number(v.teamSize) : null,
    status: v.status,
    visibility: v.visibility,
    industryIds: v.industryIds,
  };
}

async function uploadLogo(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", "startup_logo");
  const res = await fetch("/api/v1/uploads", { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed. Try a smaller image.");
  return json.url;
}

export function StartupForm({
  mode,
  initial,
  industries,
  startupId,
  slug,
}: {
  mode: "create" | "edit";
  initial: StartupFormValues;
  industries: { id: string; name: string }[];
  startupId?: string;
  slug?: string;
}) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const set = <K extends keyof StartupFormValues>(k: K, value: StartupFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const err = (k: string) => errors[k]?.[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const input = toInput(v);
    const res = mode === "create" ? await createStartupAction(input) : await updateStartupAction(startupId!, input, slug!);
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(mode === "create" ? "Startup created." : "Saved.");
    const target = mode === "create" && "slug" in res.data ? res.data.slug : slug;
    router.push(`/startups/${target}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card>
        <CardContent className="space-y-5">
          <h2 className="text-[15px] font-semibold">Basics</h2>
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.logoUrl ? <img src={v.logoUrl} alt="Logo preview" className="size-full object-cover" /> : <span className="text-lg font-semibold text-subtle">{v.name.slice(0, 1) || "?"}</span>}
            </div>
            <label className="cursor-pointer text-sm font-medium text-brand-ink hover:underline">
              {v.logoUrl ? "Change logo" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    set("logoUrl", await uploadLogo(file));
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Upload failed.");
                  }
                }}
              />
            </label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Startup name" htmlFor="name" error={err("name")}>
              <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required aria-invalid={!!err("name")} />
            </Field>
            <Field label="Stage" htmlFor="stage">
              <NativeSelect id="stage" value={v.stage} onChange={(e) => set("stage", e.target.value as StartupFormValues["stage"])}>
                {STARTUP_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Tagline" htmlFor="tagline" hint="One line that explains what you do." error={err("tagline")}>
            <Input id="tagline" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={140} />
          </Field>
          <Field label="Description" htmlFor="description" optional>
            <Textarea id="description" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-medium">Industries</p>
            <div className="flex flex-wrap gap-2">
              {industries.map((i) => (
                <Chip
                  key={i.id}
                  size="sm"
                  selected={v.industryIds.includes(i.id)}
                  onToggle={() =>
                    set("industryIds", v.industryIds.includes(i.id) ? v.industryIds.filter((x) => x !== i.id) : v.industryIds.length < 5 ? [...v.industryIds, i.id] : v.industryIds)
                  }
                >
                  {i.name}
                </Chip>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <h2 className="text-[15px] font-semibold">Problem & solution</h2>
          <Field label="What problem are you solving?" htmlFor="problem" optional>
            <Textarea id="problem" value={v.problem} onChange={(e) => set("problem", e.target.value)} maxLength={1200} />
          </Field>
          <Field label="How are you solving it?" htmlFor="solution" optional>
            <Textarea id="solution" value={v.solution} onChange={(e) => set("solution", e.target.value)} maxLength={1200} />
          </Field>
          <Field label="Traction" htmlFor="traction" optional hint="Interviews, waitlist, users, revenue — be concrete.">
            <Textarea id="traction" value={v.traction} onChange={(e) => set("traction", e.target.value)} maxLength={1200} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <h2 className="text-[15px] font-semibold">Details</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Business model" htmlFor="model" optional>
              <NativeSelect id="model" value={v.businessModel} onChange={(e) => set("businessModel", e.target.value)}>
                <option value="">Not sure yet</option>
                {BUSINESS_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {BUSINESS_MODEL_LABELS[m]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Founded" htmlFor="founded" optional>
              <Input id="founded" type="date" value={v.foundedOn} onChange={(e) => set("foundedOn", e.target.value)} />
            </Field>
            <Field label="Location" htmlFor="location" optional>
              <Input id="location" value={v.location} onChange={(e) => set("location", e.target.value)} maxLength={100} />
            </Field>
            <Field label="Work mode" htmlFor="workmode" optional>
              <NativeSelect id="workmode" value={v.workMode} onChange={(e) => set("workMode", e.target.value)}>
                <option value="">—</option>
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>
                    {WORK_MODE_LABELS[m]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Website" htmlFor="website" optional error={err("websiteUrl")}>
              <Input id="website" value={v.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="yourstartup.com" inputMode="url" />
            </Field>
            <Field label="Pitch deck link" htmlFor="deck" optional error={err("pitchDeckUrl")}>
              <Input id="deck" value={v.pitchDeckUrl} onChange={(e) => set("pitchDeckUrl", e.target.value)} inputMode="url" />
            </Field>
            <Field label="Funding status" htmlFor="funding" optional>
              <NativeSelect id="funding" value={v.fundingStatus} onChange={(e) => set("fundingStatus", e.target.value)}>
                <option value="">—</option>
                {FUNDING_STATUSES.map((f) => (
                  <option key={f} value={f}>
                    {FUNDING_STATUS_LABELS[f]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Funding raised (USD)" htmlFor="raised" optional>
              <Input id="raised" value={v.fundingRaised} onChange={(e) => set("fundingRaised", e.target.value)} inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="Team size" htmlFor="team" optional>
              <Input id="team" type="number" min={1} value={v.teamSize} onChange={(e) => set("teamSize", e.target.value)} />
            </Field>
            {mode === "edit" && (
              <Field label="Status" htmlFor="status">
                <NativeSelect id="status" value={v.status} onChange={(e) => set("status", e.target.value as StartupFormValues["status"])}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="acquired">Acquired</option>
                  <option value="shut_down">Shut down</option>
                </NativeSelect>
              </Field>
            )}
            <Field label="Visibility" htmlFor="visibility" hint="Hidden startups are only visible to your team.">
              <NativeSelect id="visibility" value={v.visibility} onChange={(e) => set("visibility", e.target.value as StartupFormValues["visibility"])}>
                <option value="public">Public on You&amp;Me</option>
                <option value="hidden">Team only</option>
              </NativeSelect>
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex justify-end gap-2 rounded-[14px] border border-border bg-background/90 p-3 backdrop-blur-md lg:bottom-4">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={!v.name.trim()}>
          {mode === "create" ? "Create startup" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
