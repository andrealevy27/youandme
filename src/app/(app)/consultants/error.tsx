"use client";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConsultantsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={<RotateCcw />}
      title="We couldn't load consultants"
      description="Something went wrong on our side. It's usually temporary — give it another try."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
