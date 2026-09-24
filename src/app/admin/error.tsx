"use client";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-md rounded-[16px] border border-border bg-card p-8 text-center shadow-soft">
      <h1 className="text-lg font-semibold tracking-tight">This admin page didn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong on our side. Nothing was changed. Try again, and if it keeps happening check the server logs
        {error.digest ? ` for reference ${error.digest}` : ""}.
      </p>
      <Button className="mt-5" onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
