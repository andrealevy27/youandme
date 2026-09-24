"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CreditCard, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type WithReason = (raw: { bookingId: string; reason?: string }) => Promise<Result<unknown>>;

export type BookingActionHandlers = {
  pay: (raw: { bookingId: string }) => Promise<Result<{ redirectUrl: string; external: boolean }>>;
  cancel: WithReason;
  complete: (raw: { bookingId: string }) => Promise<Result<unknown>>;
  dispute: (raw: { bookingId: string; reason: string }) => Promise<Result<unknown>>;
  refund: WithReason;
};

export function BookingActions({
  bookingId,
  can,
  cancelBlockedReason,
  isPaid,
  testMode,
  handlers,
}: {
  bookingId: string;
  can: { pay: boolean; cancel: boolean; complete: boolean; dispute: boolean; refund: boolean };
  cancelBlockedReason: string | null;
  isPaid: boolean;
  testMode: boolean;
  handlers: BookingActionHandlers;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "cancel" | "dispute" | "refund">(null);
  const [reason, setReason] = useState("");

  function run<T>(fn: () => Promise<Result<T>>, success: string, after?: (data: T) => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      setDialog(null);
      setReason("");
      if (after) after(res.data);
      else router.refresh();
    });
  }

  const any = can.pay || can.cancel || can.complete || can.dispute || can.refund;
  if (!any && !cancelBlockedReason) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {can.pay && (
          <Button
            loading={pending}
            onClick={() =>
              run(() => handlers.pay({ bookingId }), testMode ? "Test booking confirmed" : "Opening secure checkout…", (d) => {
                if (d.external) window.location.href = d.redirectUrl;
                else router.push(d.redirectUrl);
                router.refresh();
              })
            }
          >
            <CreditCard /> {testMode ? "Confirm test payment" : "Complete payment"}
          </Button>
        )}
        {can.complete && (
          <Button loading={pending} onClick={() => run(() => handlers.complete({ bookingId }), "Marked as completed")}>
            <CheckCircle2 /> Mark as completed
          </Button>
        )}
        {can.cancel && (
          <Button variant="secondary" onClick={() => setDialog("cancel")}>
            <XCircle /> Cancel booking
          </Button>
        )}
        {can.refund && (
          <Button variant="secondary" onClick={() => setDialog("refund")}>
            <RotateCcw /> Issue refund
          </Button>
        )}
        {can.dispute && (
          <Button variant="ghost" onClick={() => setDialog("dispute")}>
            <AlertTriangle /> Report a problem
          </Button>
        )}
      </div>
      {!can.cancel && cancelBlockedReason && !can.complete && <p className="text-[13px] text-muted">{cancelBlockedReason}</p>}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && (
          <DialogContent
            title={dialog === "cancel" ? "Cancel this booking?" : dialog === "refund" ? "Refund this booking?" : "Report a problem"}
            description={
              dialog === "cancel"
                ? isPaid
                  ? "You'll receive a full refund to your original payment method."
                  : "The time will be released."
                : dialog === "refund"
                  ? "The client gets a full refund, and the platform fee is returned too."
                  : "Tell us what went wrong. Our team will review the booking and follow up with both sides."
            }
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (dialog === "cancel") run(() => handlers.cancel({ bookingId, reason: reason.trim() || undefined }), "Booking cancelled");
                else if (dialog === "refund") run(() => handlers.refund({ bookingId, reason: reason.trim() || undefined }), "Refund issued");
                else run(() => handlers.dispute({ bookingId, reason: reason.trim() }), "Thanks — we're on it");
              }}
            >
              <Field label={dialog === "dispute" ? "What happened?" : "Reason"} htmlFor="action-reason" optional={dialog !== "dispute"}>
                <Textarea id="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={dialog === "dispute" ? 2000 : 1000} required={dialog === "dispute"} minLength={dialog === "dispute" ? 10 : undefined} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                  Never mind
                </Button>
                <Button type="submit" variant={dialog === "dispute" ? "primary" : "danger"} loading={pending}>
                  {dialog === "cancel" ? "Cancel booking" : dialog === "refund" ? "Refund in full" : "Send to You&Me"}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
