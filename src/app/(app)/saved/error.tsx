"use client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";

export default function SavedError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <ErrorState
        message="We couldn't load your saved items. Try again."
        retry={
          <Button size="sm" variant="secondary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
