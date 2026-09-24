"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { respondToInviteAction } from "@/app/(app)/startups/actions";

export function InviteResponse({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"accept" | "decline" | null>(null);
  async function respond(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    const res = await respondToInviteAction(token, accept);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    if (res.data.accepted) {
      toast.success("Welcome to the team.");
      router.push(`/startups/${res.data.slug}`);
    } else router.refresh();
  }
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => respond(false)} loading={busy === "decline"} disabled={!!busy}>
        Decline
      </Button>
      <Button size="sm" onClick={() => respond(true)} loading={busy === "accept"} disabled={!!busy}>
        Accept
      </Button>
    </div>
  );
}
