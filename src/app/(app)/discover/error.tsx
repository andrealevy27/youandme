"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";

export default function DiscoverError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      message="We couldn't load Discover. Try again."
      retry={
        <Button size="sm" variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
