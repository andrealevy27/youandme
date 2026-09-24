"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

type Result = { ok: true; data: { sent: number } } | { ok: false; error: string };

export function BroadcastForm({
  audiences,
  counts,
  action,
}: {
  audiences: { value: string; label: string }[];
  counts: Record<string, { total: number; real: number }>;
  action: (input: unknown) => Promise<Result>;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [audience, setAudience] = React.useState("all");
  const [excludeDemo, setExcludeDemo] = React.useState(true);
  const c = counts[audience] ?? { total: 0, real: 0 };
  const recipients = excludeDemo ? c.real : c.total;
  const audienceLabel = audiences.find((a) => a.value === audience)?.label ?? audience;

  async function send() {
    const form = formRef.current;
    if (!form) return false;
    const fd = new FormData(form);
    const res = await action({
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
      href: String(fd.get("href") ?? ""),
      audience,
      excludeDemo,
    });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(`Sent to ${res.data.sent.toLocaleString()} ${res.data.sent === 1 ? "member" : "members"}`);
    form.reset();
    router.refresh();
    return true;
  }

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="grid gap-4">
      <Field label="Title" htmlFor="b-title">
        <Input id="b-title" name="title" required minLength={3} maxLength={120} placeholder="New: book consultants in two taps" />
      </Field>
      <Field label="Message" htmlFor="b-body" optional>
        <Textarea id="b-body" name="body" maxLength={1000} />
      </Field>
      <Field label="Link" htmlFor="b-href" hint="An in-app path members open when they tap it, e.g. /consultants" optional>
        <Input id="b-href" name="href" maxLength={300} pattern="/[^/].*|/" placeholder="/consultants" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Audience" htmlFor="b-audience">
          <NativeSelect id="b-audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {audiences.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex items-center gap-2.5 self-end pb-3 text-[13.5px] font-medium">
          <input type="checkbox" checked={excludeDemo} onChange={(e) => setExcludeDemo(e.target.checked)} className="size-4 accent-[var(--brand)]" />
          Skip demo accounts
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[13px] text-muted">
          Reaches <span className="font-semibold text-foreground tabular-nums">{recipients.toLocaleString()}</span> active {recipients === 1 ? "member" : "members"}. In-app only.
        </p>
        <ConfirmDialog
          config={{
            title: `Send to ${recipients.toLocaleString()} ${recipients === 1 ? "member" : "members"}?`,
            description: `Audience: ${audienceLabel}${excludeDemo ? " (demo accounts skipped)" : ""}. Broadcasts can't be unsent.`,
            confirmLabel: "Send broadcast",
          }}
          onConfirm={send}
          trigger={
            <Button
              type="button"
              disabled={recipients === 0}
              onClick={(e) => {
                // Validate the fields before opening the confirmation.
                if (!formRef.current?.reportValidity()) e.preventDefault();
              }}
            >
              <Send /> Review &amp; send
            </Button>
          }
        />
      </div>
    </form>
  );
}
