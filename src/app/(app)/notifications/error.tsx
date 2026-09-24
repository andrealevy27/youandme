"use client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";

export default function NotificationsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <ErrorState
        message="We couldn't load your notifications. Try again."
        retry={
          <Button size="sm" variant="secondary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
