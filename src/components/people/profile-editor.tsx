"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Plus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  addEducationAction,
  addExperienceAction,
  removeEducationAction,
  removeExperienceAction,
  setIndustriesAction,
  setSkillsAction,
  updateHandleAction,
  updateProfileAction,
} from "@/app/(app)/profile/actions";
import {
  AMBITIONS,
  AMBITION_LABELS,
  AVAILABILITY,
  AVAILABILITY_LABELS,
  COFOUNDER_TYPES,
  COFOUNDER_TYPE_LABELS,
  COMMITMENTS,
  COMMITMENT_LABELS,
  FOUNDER_EXPERIENCE,
  FOUNDER_EXPERIENCE_LABELS,
  INTENTS,
  INTENT_LABELS,
  SKILL_CATEGORY_LABELS,
  STAGE_LABELS,
  STARTUP_STAGES,
  WORK_MODES,
  WORK_MODE_LABELS,
  type Ambition,
  type Availability,
  type CofounderType,
  type Commitment,
  type FounderExperience,
  type Intent,
  type SkillCategory,
  type StartupStage,
  type WorkMode,
} from "@/lib/domain";
import type { ProfilePatch } from "@/server/people/profile";

type ProfileState = {
  handle: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  city: string;
  country: string;
  timezone: string;
  university: string;
  currentRole: string;
  currentCompany: string;
  yearsExperience: number | null;
  linkedinUrl: string;
  websiteUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  commitment: Commitment | null;
  availability: Availability | null;
  workMode: WorkMode | null;
  ambition: Ambition | null;
  founderExperience: FounderExperience | null;
  lookingForCofounder: boolean;
  cofounderTypes: CofounderType[];
  stagePreferences: StartupStage[];
  lookingFor: string;
  equityExpectation: string;
  intents: Intent[];
};

type Exp = { id: string; title: string; company: string; startYear: number | null; endYear: number | null; isCurrent: boolean };
type Edu = { id: string; school: string; degree: string | null; field: string | null; endYear: number | null };

function Section({ id, title, description, children, onSave, saving }: { id: string; title: string; description?: string; children: React.ReactNode; onSave?: () => void; saving?: boolean }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardContent>
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {children}
        {onSave && (
          <div className="mt-6 flex justify-end">
            <Button onClick={onSave} loading={saving}>
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function ProfileEditor(props: {
  profile: ProfileState;
  skillIds: string[];
  industryIds: string[];
  experiences: Exp[];
  educations: Edu[];
  skills: { id: string; name: string; category: string }[];
  industries: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [p, setP] = React.useState(props.profile);
  const [skillIds, setSkillIds] = React.useState(props.skillIds);
  const [industryIds, setIndustryIds] = React.useState(props.industryIds);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const set = <K extends keyof ProfileState>(k: K, v: ProfileState[K]) => setP((s) => ({ ...s, [k]: v }));

  async function save(section: string, patch: ProfilePatch) {
    setSaving(section);
    setErrors({});
    const res = await updateProfileAction(patch);
    setSaving(null);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast.error(res.error);
    }
    toast.success("Saved.");
    router.refresh();
  }

  async function uploadAvatar(file: File) {
    setSaving("photo");
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", "avatar");
    const res = await fetch("/api/v1/uploads", { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      setSaving(null);
      return toast.error(json.error ?? "Upload failed. Try a smaller image.");
    }
    set("avatarUrl", json.url);
    await save("photo", { avatarUrl: json.url });
  }

  const allSkills = props.skills;
  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof allSkills>();
    for (const s of allSkills) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return [...map.entries()];
  }, [allSkills]);

  const [exp, setExp] = React.useState({ title: "", company: "", startYear: "", endYear: "", isCurrent: false });
  const [edu, setEdu] = React.useState({ school: "", degree: "", field: "", endYear: "" });

  return (
    <div className="space-y-5">
      <Section id="photo" title="Photo">
        <div className="flex items-center gap-5">
          <Avatar name={p.displayName} src={p.avatarUrl} size="xl" />
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-brand-ink hover:underline">
              <Camera className="size-4" aria-hidden /> {p.avatarUrl ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            </label>
            {p.avatarUrl && (
              <button type="button" className="self-start text-sm text-muted hover:text-foreground" onClick={() => { set("avatarUrl", null); void save("photo", { avatarUrl: null }); }}>
                Remove photo
              </button>
            )}
            <p className="text-xs text-subtle">JPG, PNG or WebP, up to 5MB. A clear face photo gets more replies.</p>
          </div>
        </div>
      </Section>

      <Section id="basics" title="Basics" saving={saving === "basics"} onSave={() => save("basics", { displayName: p.displayName, headline: p.headline, bio: p.bio, city: p.city, country: p.country })}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="displayName" error={errors.displayName?.[0]}>
            <Input id="displayName" value={p.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Handle" htmlFor="handle" hint="youandme.company/people/your-handle">
            <div className="flex gap-2">
              <Input id="handle" value={p.handle} onChange={(e) => set("handle", e.target.value.toLowerCase())} maxLength={30} />
              <Button
                variant="secondary"
                onClick={async () => {
                  const res = await updateHandleAction(p.handle);
                  if (!res.ok) return toast.error(res.error);
                  toast.success("Handle updated.");
                  router.refresh();
                }}
              >
                Update
              </Button>
            </div>
          </Field>
        </div>
        <div className="mt-5 space-y-5">
          <Field label="Headline" htmlFor="headline">
            <Input id="headline" value={p.headline} onChange={(e) => set("headline", e.target.value)} maxLength={120} />
          </Field>
          <Field label="About" htmlFor="bio" hint="What you've done, what you care about, and what you want to build next.">
            <Textarea id="bio" value={p.bio} onChange={(e) => set("bio", e.target.value)} maxLength={1200} className="min-h-32" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="City" htmlFor="city">
              <Input id="city" value={p.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Country" htmlFor="country">
              <Input id="country" value={p.country} onChange={(e) => set("country", e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        id="work"
        title="Current work"
        saving={saving === "work"}
        onSave={() => save("work", { currentRole: p.currentRole, currentCompany: p.currentCompany, university: p.university, yearsExperience: p.yearsExperience })}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Role" htmlFor="currentRole">
            <Input id="currentRole" value={p.currentRole} onChange={(e) => set("currentRole", e.target.value)} />
          </Field>
          <Field label="Company" htmlFor="currentCompany">
            <Input id="currentCompany" value={p.currentCompany} onChange={(e) => set("currentCompany", e.target.value)} />
          </Field>
          <Field label="University" htmlFor="university">
            <Input id="university" value={p.university} onChange={(e) => set("university", e.target.value)} />
          </Field>
          <Field label="Years of experience" htmlFor="years">
            <Input id="years" type="number" min={0} max={60} value={p.yearsExperience ?? ""} onChange={(e) => set("yearsExperience", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
        </div>
      </Section>

      <Section id="skills" title="Skills & industries" description="Your first two skills are highlighted on your profile." saving={saving === "skills"} onSave={async () => {
        setSaving("skills");
        const [a, b] = await Promise.all([setSkillsAction(skillIds), setIndustriesAction(industryIds)]);
        setSaving(null);
        if (!a.ok) return toast.error(a.error);
        if (!b.ok) return toast.error(b.error);
        toast.success("Saved.");
        router.refresh();
      }}>
        <div className="space-y-5">
          {grouped.map(([cat, items]) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">{SKILL_CATEGORY_LABELS[cat as SkillCategory] ?? cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((s) => (
                  <Chip key={s.id} size="sm" selected={skillIds.includes(s.id)} onToggle={() => setSkillIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : ids.length < 15 ? [...ids, s.id] : ids))}>
                    {s.name}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Industries</p>
            <div className="flex flex-wrap gap-1.5">
              {props.industries.map((i) => (
                <Chip key={i.id} size="sm" selected={industryIds.includes(i.id)} onToggle={() => setIndustryIds((ids) => (ids.includes(i.id) ? ids.filter((x) => x !== i.id) : ids.length < 8 ? [...ids, i.id] : ids))}>
                  {i.name}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="goals"
        title="What you're looking for"
        saving={saving === "goals"}
        onSave={() =>
          save("goals", {
            intents: p.intents,
            lookingForCofounder: p.lookingForCofounder,
            cofounderTypes: p.cofounderTypes,
            stagePreferences: p.stagePreferences,
            commitment: p.commitment,
            availability: p.availability,
            workMode: p.workMode,
            ambition: p.ambition,
            founderExperience: p.founderExperience,
            lookingFor: p.lookingFor,
            equityExpectation: p.equityExpectation,
          })
        }
      >
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-[13px] font-medium">What brings you here</p>
            <div className="flex flex-wrap gap-1.5">
              {INTENTS.map((i) => (
                <Chip key={i} size="sm" selected={p.intents.includes(i)} onToggle={() => set("intents", toggle(p.intents, i))}>
                  {INTENT_LABELS[i]}
                </Chip>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-[12px] bg-surface px-4 py-3">
            <span>
              <span className="text-sm font-medium">Cofounder matching</span>
              <span className="block text-[13px] text-muted">Receive up to five curated cofounder recommendations a day.</span>
            </span>
            <Switch checked={p.lookingForCofounder} onCheckedChange={(v) => set("lookingForCofounder", v)} aria-label="Cofounder matching" />
          </label>
          {p.lookingForCofounder && (
            <div>
              <p className="mb-2 text-[13px] font-medium">Cofounder types</p>
              <div className="flex flex-wrap gap-1.5">
                {COFOUNDER_TYPES.map((t) => (
                  <Chip key={t} size="sm" selected={p.cofounderTypes.includes(t)} onToggle={() => set("cofounderTypes", toggle(p.cofounderTypes, t))}>
                    {COFOUNDER_TYPE_LABELS[t]}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Commitment" htmlFor="commitment">
              <NativeSelect id="commitment" value={p.commitment ?? ""} onChange={(e) => set("commitment", (e.target.value || null) as Commitment | null)}>
                <option value="">—</option>
                {COMMITMENTS.map((c) => (
                  <option key={c} value={c}>
                    {COMMITMENT_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Availability" htmlFor="availability">
              <NativeSelect id="availability" value={p.availability ?? ""} onChange={(e) => set("availability", (e.target.value || null) as Availability | null)}>
                <option value="">—</option>
                {AVAILABILITY.map((c) => (
                  <option key={c} value={c}>
                    {AVAILABILITY_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Work mode" htmlFor="workMode">
              <NativeSelect id="workMode" value={p.workMode ?? ""} onChange={(e) => set("workMode", (e.target.value || null) as WorkMode | null)}>
                <option value="">—</option>
                {WORK_MODES.map((c) => (
                  <option key={c} value={c}>
                    {WORK_MODE_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Ambition" htmlFor="ambition">
              <NativeSelect id="ambition" value={p.ambition ?? ""} onChange={(e) => set("ambition", (e.target.value || null) as Ambition | null)}>
                <option value="">—</option>
                {AMBITIONS.map((c) => (
                  <option key={c} value={c}>
                    {AMBITION_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Founder experience" htmlFor="founderExperience">
              <NativeSelect id="founderExperience" value={p.founderExperience ?? ""} onChange={(e) => set("founderExperience", (e.target.value || null) as FounderExperience | null)}>
                <option value="">—</option>
                {FOUNDER_EXPERIENCE.map((c) => (
                  <option key={c} value={c}>
                    {FOUNDER_EXPERIENCE_LABELS[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Equity expectations" htmlFor="equity">
              <Input id="equity" value={p.equityExpectation} onChange={(e) => set("equityExpectation", e.target.value)} maxLength={200} />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium">Startup stages you&apos;re interested in</p>
            <div className="flex flex-wrap gap-1.5">
              {STARTUP_STAGES.map((s) => (
                <Chip key={s} size="sm" selected={p.stagePreferences.includes(s)} onToggle={() => set("stagePreferences", toggle(p.stagePreferences, s))}>
                  {STAGE_LABELS[s]}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="In your own words" htmlFor="lookingFor">
            <Textarea id="lookingFor" value={p.lookingFor} onChange={(e) => set("lookingFor", e.target.value)} maxLength={500} />
          </Field>
        </div>
      </Section>

      <Section id="experience" title="Experience">
        {props.experiences.length > 0 && (
          <ul className="mb-5 divide-y divide-border">
            {props.experiences.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {e.title} · {e.company}
                  </p>
                  <p className="text-xs text-subtle">
                    {e.startYear ?? ""} – {e.isCurrent ? "Present" : (e.endYear ?? "")}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${e.title}`}
                  onClick={async () => {
                    const res = await removeExperienceAction(e.id);
                    if (!res.ok) return toast.error(res.error);
                    router.refresh();
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Title" aria-label="Title" value={exp.title} onChange={(e) => setExp({ ...exp, title: e.target.value })} />
          <Input placeholder="Company" aria-label="Company" value={exp.company} onChange={(e) => setExp({ ...exp, company: e.target.value })} />
          <Input placeholder="Start year" aria-label="Start year" inputMode="numeric" value={exp.startYear} onChange={(e) => setExp({ ...exp, startYear: e.target.value })} />
          <Input placeholder="End year" aria-label="End year" inputMode="numeric" value={exp.endYear} disabled={exp.isCurrent} onChange={(e) => setExp({ ...exp, endYear: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={exp.isCurrent} onCheckedChange={(v) => setExp({ ...exp, isCurrent: v })} aria-label="I currently work here" /> I work here now
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={!exp.title || !exp.company}
            onClick={async () => {
              const res = await addExperienceAction({
                title: exp.title,
                company: exp.company,
                startYear: exp.startYear ? Number(exp.startYear) : null,
                endYear: exp.endYear && !exp.isCurrent ? Number(exp.endYear) : null,
                isCurrent: exp.isCurrent,
              });
              if (!res.ok) return toast.error(res.error);
              setExp({ title: "", company: "", startYear: "", endYear: "", isCurrent: false });
              router.refresh();
            }}
          >
            <Plus /> Add
          </Button>
        </div>
      </Section>

      <Section id="education" title="Education">
        {props.educations.length > 0 && (
          <ul className="mb-5 divide-y divide-border">
            {props.educations.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3 first:pt-0">
                <p className="flex-1 text-sm">
                  <span className="font-medium">{e.school}</span>
                  {e.degree && <span className="text-muted"> · {e.degree}</span>}
                  {e.endYear && <span className="text-subtle"> · {e.endYear}</span>}
                </p>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${e.school}`}
                  onClick={async () => {
                    const res = await removeEducationAction(e.id);
                    if (!res.ok) return toast.error(res.error);
                    router.refresh();
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="School" aria-label="School" value={edu.school} onChange={(e) => setEdu({ ...edu, school: e.target.value })} />
          <Input placeholder="Degree" aria-label="Degree" value={edu.degree} onChange={(e) => setEdu({ ...edu, degree: e.target.value })} />
          <Input placeholder="Field" aria-label="Field of study" value={edu.field} onChange={(e) => setEdu({ ...edu, field: e.target.value })} />
          <Input placeholder="Graduation year" aria-label="Graduation year" inputMode="numeric" value={edu.endYear} onChange={(e) => setEdu({ ...edu, endYear: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={!edu.school}
            onClick={async () => {
              const res = await addEducationAction({ school: edu.school, degree: edu.degree, field: edu.field, endYear: edu.endYear ? Number(edu.endYear) : null });
              if (!res.ok) return toast.error(res.error);
              setEdu({ school: "", degree: "", field: "", endYear: "" });
              router.refresh();
            }}
          >
            <Plus /> Add
          </Button>
        </div>
      </Section>

      <Section
        id="links"
        title="Links"
        saving={saving === "links"}
        onSave={() => save("links", { linkedinUrl: p.linkedinUrl, websiteUrl: p.websiteUrl, githubUrl: p.githubUrl, portfolioUrl: p.portfolioUrl })}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="LinkedIn" htmlFor="linkedin" error={errors.linkedinUrl?.[0]}>
            <Input id="linkedin" value={p.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} inputMode="url" placeholder="linkedin.com/in/…" />
          </Field>
          <Field label="Website" htmlFor="website" error={errors.websiteUrl?.[0]}>
            <Input id="website" value={p.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} inputMode="url" />
          </Field>
          <Field label="GitHub" htmlFor="github" error={errors.githubUrl?.[0]}>
            <Input id="github" value={p.githubUrl} onChange={(e) => set("githubUrl", e.target.value)} inputMode="url" />
          </Field>
          <Field label="Portfolio" htmlFor="portfolio" error={errors.portfolioUrl?.[0]}>
            <Input id="portfolio" value={p.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} inputMode="url" />
          </Field>
        </div>
        <p className="mt-4 text-xs text-subtle">Adding a LinkedIn URL doesn&apos;t verify it — the “LinkedIn linked” badge appears only after signing in with LinkedIn.</p>
      </Section>
    </div>
  );
}
