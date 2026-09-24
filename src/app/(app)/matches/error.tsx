"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";

export default function MatchesError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      message="We couldn't load your matches. Try again."
      retry={
        <Button size="sm" variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
