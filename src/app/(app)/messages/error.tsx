"use client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";

export default function MessagesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-5">
      <ErrorState
        message="We couldn't load your messages. Check your connection and try again."
        retry={
          <Button size="sm" variant="secondary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
