"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { PRICING_TYPES, PRICING_TYPE_LABELS, type PricingType } from "@/lib/domain";
import { formatDuration, formatServicePrice } from "../format";
import type { Result } from "./types";

export type ServiceRow = {
  id: string;
  title: string;
  description: string;
  pricingType: PricingType;
  priceCents: number;
  currency: string;
  durationMinutes: number;
  billingInterval: string | null;
  includes: string[];
  categorySlug: string | null;
  active: boolean;
};

type ServiceInput = {
  id?: string;
  title: string;
  description: string;
  pricingType: PricingType;
  priceCents: number;
  durationMinutes: number;
  billingInterval?: "week" | "month" | null;
  includes: string[];
  categorySlug?: string | null;
};

const PRICE_LABEL: Record<PricingType, string> = {
  fixed: "Price (USD)",
  hourly: "Rate per hour (USD)",
  package: "Package price (USD)",
  recurring: "Price per billing period (USD)",
};
const DURATION_LABEL: Record<PricingType, string> = {
  fixed: "Session length",
  hourly: "Session length",
  package: "Kickoff call length",
  recurring: "First call length",
};

export function ServicesManager({
  services,
  categories,
  upsert,
  setActive,
}: {
  services: ServiceRow[];
  categories: { slug: string; name: string }[];
  upsert: (raw: ServiceInput) => Promise<Result<{ id: string }>>;
  setActive: (raw: { serviceId: string; active: boolean }) => Promise<Result>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      {services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Add at least one service so founders can book you — e.g. a 60-minute strategy session."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add a service
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-[14px] border border-border">
            {services.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {s.title} {!s.active && <Badge>Archived</Badge>}
                  </p>
                  <p className="text-[13px] text-muted">
                    {formatServicePrice(s.priceCents, s.currency, s.pricingType, s.billingInterval)} · {PRICING_TYPE_LABELS[s.pricingType]} · {formatDuration(s.durationMinutes)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                    <Pencil /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setActive({ serviceId: s.id, active: !s.active });
                        if (!res.ok) return void toast.error(res.error);
                        toast.success(s.active ? "Service archived" : "Service restored");
                        router.refresh();
                      })
                    }
                  >
                    {s.active ? <Archive /> : <ArchiveRestore />} {s.active ? "Archive" : "Restore"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-3" onClick={() => setEditing("new")}>
            <Plus /> Add a service
          </Button>
        </>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent title={editing === "new" ? "New service" : "Edit service"} description="Past bookings keep the price and title they were booked with.">
            <ServiceForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              categories={categories}
              onSave={async (input) => {
                const res = await upsert(input);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Service saved");
                setEditing(null);
                router.refresh();
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function ServiceForm({ initial, categories, onSave }: { initial: ServiceRow | null; categories: { slug: string; name: string }[]; onSave: (s: ServiceInput) => Promise<void> }) {
  const [pricingType, setPricingType] = useState<PricingType>(initial?.pricingType ?? "fixed");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const str = (k: string) => String(f.get(k) ?? "").trim();
        start(() =>
          onSave({
            id: initial?.id,
            title: str("title"),
            description: str("description"),
            pricingType,
            priceCents: Math.round(Number(str("price")) * 100),
            durationMinutes: Number(str("duration")),
            billingInterval: pricingType === "recurring" ? (str("interval") as "week" | "month") : null,
            includes: str("includes")
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
            categorySlug: str("category") || null,
          }),
        );
      }}
    >
      <Field label="Title" htmlFor="svc-title">
        <Input id="svc-title" name="title" defaultValue={initial?.title} maxLength={100} required placeholder="Growth Strategy Session" />
      </Field>
      <Field label="Description" htmlFor="svc-desc">
        <Textarea id="svc-desc" name="description" defaultValue={initial?.description} maxLength={2000} required minLength={10} rows={3} placeholder="What the founder gets and who it's for." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pricing" htmlFor="svc-type">
          <NativeSelect id="svc-type" value={pricingType} onChange={(e) => setPricingType(e.target.value as PricingType)}>
            {PRICING_TYPES.map((t) => (
              <option key={t} value={t}>
                {PRICING_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={PRICE_LABEL[pricingType]} htmlFor="svc-price">
          <Input id="svc-price" name="price" type="number" min={5} step="0.01" required defaultValue={initial ? initial.priceCents / 100 : ""} />
        </Field>
        {pricingType === "recurring" && (
          <Field label="Billed every" htmlFor="svc-interval">
            <NativeSelect id="svc-interval" name="interval" defaultValue={initial?.billingInterval ?? "month"}>
              <option value="month">Month</option>
              <option value="week">Week</option>
            </NativeSelect>
          </Field>
        )}
        <Field label={DURATION_LABEL[pricingType]} htmlFor="svc-duration">
          <NativeSelect id="svc-duration" name="duration" defaultValue={String(initial?.durationMinutes ?? 60)}>
            {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
              <option key={m} value={m}>
                {formatDuration(m)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Category" htmlFor="svc-category" optional>
          <NativeSelect id="svc-category" name="category" defaultValue={initial?.categorySlug ?? ""}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="What's included" htmlFor="svc-includes" optional hint="One item per line.">
        <Textarea id="svc-includes" name="includes" defaultValue={initial?.includes.join("\n")} rows={3} placeholder={"Pre-call questionnaire\nWritten recommendations"} />
      </Field>
      <Button type="submit" loading={pending}>
        Save service
      </Button>
    </form>
  );
}
