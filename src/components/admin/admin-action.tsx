"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog, type ConfirmConfig } from "./confirm-dialog";

/** Shape every admin server action returns (mirrors ActionResult without importing server code). */
export type AdminActionResult = { ok: true; data: unknown } | { ok: false; error: string };
export type AdminServerAction = (input: unknown) => Promise<AdminActionResult>;

function useRunAction(action: AdminServerAction, success?: string) {
  const router = useRouter();
  return async (input: Record<string, unknown>) => {
    const res = await action(input);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    if (success) toast.success(success);
    router.refresh();
    return true;
  };
}

/**
 * A button bound to a server action. `payload` is merged with any values collected by
 * the optional confirmation dialog. Server components pass the action reference directly.
 */
export function AdminActionButton({
  action,
  payload,
  label,
  success,
  confirm,
  variant = "secondary",
  size = "sm",
  disabled,
  title,
}: {
  action: AdminServerAction;
  payload: Record<string, unknown>;
  label: React.ReactNode;
  success?: string;
  confirm?: ConfirmConfig;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  title?: string;
}) {
  const run = useRunAction(action, success);
  const [pending, startTransition] = React.useTransition();

  if (confirm) {
    return (
      <ConfirmDialog
        config={confirm}
        onConfirm={(values) => run({ ...values, ...payload })}
        trigger={
          <Button type="button" variant={variant} size={size} disabled={disabled} title={title}>
            {label}
          </Button>
        }
      />
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      title={title}
      loading={pending}
      onClick={() => startTransition(async () => void (await run(payload)))}
    >
      {label}
    </Button>
  );
}

/** Switch that persists immediately through a server action (optimistic, reverts on failure). */
export function AdminActionSwitch({
  action,
  payload,
  checked,
  label,
  disabled,
  success,
}: {
  action: AdminServerAction;
  payload: Record<string, unknown>;
  checked: boolean;
  label: string;
  disabled?: boolean;
  /** Toast messages after turning on / off. */
  success?: { on: string; off: string };
}) {
  const router = useRouter();
  const [value, setOptimistic] = React.useOptimistic(checked);
  const [pending, startTransition] = React.useTransition();
  return (
    <Switch
      checked={value}
      aria-label={label}
      disabled={disabled || pending}
      onCheckedChange={(next) => {
        startTransition(async () => {
          setOptimistic(next);
          const res = await action({ ...payload, value: next });
          if (!res.ok) {
            // The optimistic value falls back to the server value when the transition ends.
            toast.error(res.error);
            return;
          }
          if (success) toast.success(next ? success.on : success.off);
          router.refresh();
        });
      }}
    />
  );
}

/**
 * Form posting its fields (plus `payload`) to a server action as a plain object.
 * Checkboxes are sent as booleans. Children are ordinary inputs with `name`s.
 */
export function AdminActionForm({
  action,
  payload,
  children,
  submitLabel,
  success,
  resetOnSuccess,
  className,
}: {
  action: AdminServerAction;
  payload?: Record<string, unknown>;
  children: React.ReactNode;
  submitLabel: string;
  success?: string;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const run = useRunAction(action, success);
  const [pending, setPending] = React.useState(false);
  const ref = React.useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values: Record<string, unknown> = {};
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !el.name) continue;
      if (el instanceof HTMLInputElement && el.type === "checkbox") values[el.name] = el.checked;
      else values[el.name] = el.value;
    }
    setPending(true);
    const ok = await run({ ...values, ...payload });
    setPending(false);
    if (ok && resetOnSuccess) ref.current?.reset();
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className={className}>
      {children}
      <div className="mt-4 flex justify-end">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
