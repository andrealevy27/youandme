"use client";
import * as React from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason, type ReportTarget } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { reportContentAction } from "./actions";

const NOUN: Record<ReportTarget, string> = {
  user: "profile",
  message: "message",
  consultant: "consultant",
  startup: "startup",
  review: "review",
};

/**
 * Report anything reportable. Uncontrolled (renders its own trigger button, text = `label`)
 * or controlled via `open`/`onOpenChange` (e.g. opened from a dropdown menu item).
 */
export function ReportDialog({
  targetType,
  targetId,
  label = "Report",
  open,
  onOpenChange,
  trigger,
  triggerClassName,
}: {
  targetType: ReportTarget;
  targetId: string;
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Custom trigger element; omit with controlled usage. */
  trigger?: React.ReactNode;
  triggerClassName?: string;
}) {
  const controlled = open !== undefined;
  const [innerOpen, setInnerOpen] = React.useState(false);
  const isOpen = controlled ? open : innerOpen;
  const setOpen = (v: boolean) => (controlled ? onOpenChange?.(v) : setInnerOpen(v));
  const [reason, setReason] = React.useState<ReportReason | null>(null);
  const [details, setDetails] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const detailsId = React.useId();

  function reset() {
    setReason(null);
    setDetails("");
  }

  function submit() {
    if (!reason) return;
    startTransition(async () => {
      const res = await reportContentAction({ targetType, targetId, reason, details: details || undefined });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.duplicate ? "You've already reported this — we're on it." : "Thanks. Our team will review this report.");
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="sm" className={cn("text-muted", triggerClassName)}>
              <Flag /> {label}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent
        title={`Report this ${NOUN[targetType]}`}
        description="Reports are confidential. The person won't know it was you."
      >
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">What&apos;s wrong?</legend>
          <div role="radiogroup" className="grid gap-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cn(
                  "flex h-11 items-center justify-between rounded-[10px] border px-3.5 text-left text-sm transition-colors",
                  reason === r ? "border-foreground bg-card ring-1 ring-foreground" : "border-border hover:border-border-strong",
                )}
              >
                {REPORT_REASON_LABELS[r]}
                <span
                  aria-hidden
                  className={cn("size-4 rounded-full border", reason === r ? "border-[5px] border-foreground" : "border-border-strong")}
                />
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Anything else we should know?" htmlFor={detailsId} optional className="mt-4">
          <Textarea id={detailsId} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={3} className="min-h-20" />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={!reason} loading={pending}>
            Submit report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
