"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { unmatchAction } from "@/app/(app)/matches/actions";

export function UnmatchButton({ matchId, name }: { matchId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Unmatch
        </Button>
      </DialogTrigger>
      <DialogContent title={`Unmatch ${name}?`} description="You'll stop seeing each other as a match. Your conversation history stays in Messages.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const res = await unmatchAction(matchId);
              setBusy(false);
              if (!res.ok) return toast.error(res.error);
              setOpen(false);
              router.refresh();
            }}
          >
            Unmatch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
