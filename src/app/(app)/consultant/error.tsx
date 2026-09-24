"use client";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={<RotateCcw />}
      title="We couldn't load your workspace"
      description="Something went wrong on our side. Your profile and bookings are safe — try again."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
