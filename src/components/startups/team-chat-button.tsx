"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openStartupGroupChatAction } from "@/app/(app)/messages/actions";

export function TeamChatButton({ startupId }: { startupId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const res = await openStartupGroupChatAction(startupId);
        setBusy(false);
        if (!res.ok) return toast.error(res.error);
        router.push(`/messages/${res.data.conversationId}`);
      }}
    >
      <MessagesSquare /> Team chat
    </Button>
  );
}
