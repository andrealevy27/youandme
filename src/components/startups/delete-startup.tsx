"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteStartupAction } from "@/app/(app)/startups/actions";

export function DeleteStartupButton({ startupId, name }: { startupId: string; name: string }) {
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm" className="mt-4">
          Delete {name}
        </Button>
      </DialogTrigger>
      <DialogContent title={`Delete ${name}?`} description={`Type ${name} to confirm. This can't be undone from the app.`}>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirm startup name" />
        <div className="mt-4 flex justify-end">
          <Button
            variant="danger"
            disabled={confirm !== name}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const res = await deleteStartupAction(startupId);
              setBusy(false);
              if (res && !res.ok) toast.error(res.error);
            }}
          >
            Delete permanently
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
