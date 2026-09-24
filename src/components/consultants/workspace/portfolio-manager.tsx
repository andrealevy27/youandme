"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { Result } from "./types";

export function PortfolioManager({
  items,
  add,
  remove,
}: {
  items: { id: string; title: string; description: string | null; url: string | null }[];
  add: (raw: { title: string; description?: string; url?: string }) => Promise<Result>;
  remove: (raw: { id: string }) => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-[14px] border border-border">
          {items.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{p.title}</p>
                {p.description && <p className="text-[13px] text-muted">{p.description}</p>}
                {p.url && <p className="truncate text-xs text-subtle">{p.url}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${p.title}`}
                onClick={() =>
                  start(async () => {
                    const res = await remove({ id: p.id });
                    if (!res.ok) return void toast.error(res.error);
                    router.refresh();
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 rounded-[14px] border border-dashed border-border-strong p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          start(async () => {
            const res = await add({ title: String(f.get("title") ?? ""), description: String(f.get("description") ?? "") || undefined, url: String(f.get("url") ?? "") || undefined });
            if (!res.ok) return void toast.error(res.error);
            toast.success("Added to portfolio");
            form.reset();
            router.refresh();
          });
        }}
      >
        <Field label="Project" htmlFor="pf-title">
          <Input id="pf-title" name="title" required maxLength={120} placeholder="Creator program for a fitness app" />
        </Field>
        <Field label="What you did" htmlFor="pf-desc" optional>
          <Textarea id="pf-desc" name="description" maxLength={1000} rows={2} />
        </Field>
        <Field label="Link" htmlFor="pf-url" optional>
          <Input id="pf-url" name="url" type="url" maxLength={500} placeholder="https://" />
        </Field>
        <div>
          <Button type="submit" variant="secondary" loading={pending}>
            Add project
          </Button>
        </div>
      </form>
    </div>
  );
}
