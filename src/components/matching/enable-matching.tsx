"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enableCofounderMatchingAction } from "@/app/(app)/profile/actions";

export function EnableCofounderMatching() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const res = await enableCofounderMatchingAction();
        setBusy(false);
        if (!res.ok) return toast.error(res.error);
        router.refresh();
      }}
    >
      Turn on cofounder matching
    </Button>
  );
}
