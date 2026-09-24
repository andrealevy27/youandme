"use client";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function BookingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={<RotateCcw />}
      title="We couldn't load your bookings"
      description="Something went wrong on our side. Your bookings are safe — give it another try."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
