"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, CalendarCheck, Flag, MessageCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, NativeSelect, Textarea } from "@/components/ui/input";
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/lib/domain";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Actions = {
  message: (raw: { consultantId: string }) => Promise<ActionResult<{ conversationId: string }>>;
  save: (raw: { consultantId: string; saved: boolean }) => Promise<ActionResult<{ saved: boolean }>>;
  report: (raw: { consultantId: string; reason: ReportReason; details?: string }) => Promise<ActionResult<void>>;
};

export function ProfileActions({
  consultantId,
  bookHref,
  canBook,
  initiallySaved,
  actions,
  layout = "header",
}: {
  consultantId: string;
  bookHref: string | null;
  canBook: boolean;
  initiallySaved: boolean;
  actions: Actions;
  layout?: "header" | "sticky";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [reportOpen, setReportOpen] = useState(false);
  const [messaging, startMessage] = useTransition();
  const [saving, startSave] = useTransition();

  function message() {
    startMessage(async () => {
      const res = await actions.message({ consultantId });
      if (!res.ok) return void toast.error(res.error);
      router.push(`/messages/${res.data.conversationId}`);
    });
  }

  function toggleSave() {
    const next = !saved;
    setSaved(next);
    startSave(async () => {
      const res = await actions.save({ consultantId, saved: next });
      if (!res.ok) {
        setSaved(!next);
        return void toast.error(res.error);
      }
      toast.success(next ? "Saved to your list" : "Removed from saved");
    });
  }

  const book =
    bookHref && canBook ? (
      <Button asChild variant="primary" size="lg" className="flex-1 sm:flex-none">
        <Link href={bookHref}>
          <CalendarCheck /> Book consultation
        </Link>
      </Button>
    ) : null;

  if (layout === "sticky") {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          {book}
          <Button variant="secondary" size="lg" onClick={message} loading={messaging} className={book ? "" : "flex-1"}>
            <MessageCircle /> Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {book}
      <Button variant="secondary" size="lg" onClick={message} loading={messaging}>
        <MessageCircle /> Message
      </Button>
      <Button variant="ghost" size="icon" onClick={toggleSave} disabled={saving} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save consultant"}>
        {saved ? <BookmarkCheck className="text-brand" /> : <Bookmark />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem destructive onSelect={() => setReportOpen(true)}>
            <Flag /> Report profile
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} consultantId={consultantId} report={actions.report} />
    </div>
  );
}

function ReportDialog({ open, onOpenChange, consultantId, report }: { open: boolean; onOpenChange: (o: boolean) => void; consultantId: string; report: Actions["report"] }) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Report this profile" description="Reports are confidential. Our team reviews every one.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await report({ consultantId, reason, details: details || undefined });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Thanks — we'll take a look.");
              onOpenChange(false);
              setDetails("");
            });
          }}
        >
          <Field label="Reason" htmlFor="report-reason">
            <NativeSelect id="report-reason" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Details" htmlFor="report-details" optional>
            <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="What happened?" />
          </Field>
          <Button type="submit" variant="danger" loading={pending}>
            Send report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
