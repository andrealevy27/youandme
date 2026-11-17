"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinEventAction } from "@/app/(app)/events/actions";

export function JoinEventButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      size="lg"
      className="h-12 w-full"
      loading={pending}
      onClick={async () => {
        setPending(true);
        const res = await joinEventAction(code);
        if (!res.ok) {
          setPending(false);
          return void toast.error(res.error);
        }
        router.push(`/events/${res.data.code}`);
      }}
    >
      Join and see who to meet
    </Button>
  );
}
