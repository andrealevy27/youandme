"use client";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";

export type ConfirmField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
  maxLength?: number;
};

export type ConfirmConfig = {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  fields?: ConfirmField[];
};

/**
 * Confirmation modal for admin actions. Optional fields (reason, duration…) are
 * collected and passed to `onConfirm`; the dialog stays open while it runs and
 * closes only on success.
 */
export function ConfirmDialog({
  trigger,
  config,
  onConfirm,
}: {
  trigger: React.ReactElement;
  config: ConfirmConfig;
  onConfirm: (values: Record<string, string>) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const id = React.useId();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, string> = {};
    for (const f of config.fields ?? []) values[f.name] = String(fd.get(f.name) ?? "").trim();
    setPending(true);
    const ok = await onConfirm(values);
    setPending(false);
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={config.title} description={config.description}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {config.fields?.map((f) => {
            const fid = `${id}-${f.name}`;
            return (
              <Field key={f.name} label={f.label} htmlFor={fid} hint={f.hint} optional={!f.required}>
                {f.type === "textarea" ? (
                  <Textarea id={fid} name={f.name} required={f.required} placeholder={f.placeholder} defaultValue={f.defaultValue} maxLength={f.maxLength ?? 1000} />
                ) : f.type === "select" ? (
                  <NativeSelect id={fid} name={f.name} required={f.required} defaultValue={f.defaultValue}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id={fid}
                    name={f.name}
                    type={f.type === "number" ? "number" : "text"}
                    required={f.required}
                    placeholder={f.placeholder}
                    defaultValue={f.defaultValue}
                    maxLength={f.maxLength ?? 300}
                  />
                )}
              </Field>
            );
          })}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant={config.destructive ? "danger" : "primary"} loading={pending}>
              {config.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { ButtonProps };
