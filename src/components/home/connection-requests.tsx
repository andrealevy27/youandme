"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { respondConnectionAction } from "@/app/(app)/profile/actions";
import type { PersonSummary } from "@/server/people";

export function ConnectionRequests({ requests }: { requests: { id: string; message: string | null; person: PersonSummary }[] }) {
  const router = useRouter();
  const [done, setDone] = React.useState<string[]>([]);
  const visible = requests.filter((r) => !done.includes(r.id));
  if (!visible.length) return null;
  return (
    <div className="rounded-[16px] border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium">Connection requests</p>
      <ul className="space-y-3">
        {visible.map((r) => (
          <li key={r.id} className="flex items-start gap-3">
            <Avatar name={r.person.name} src={r.person.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <Link href={`/people/${r.person.handle}`} className="text-sm font-medium hover:underline">
                {r.person.name}
              </Link>
              {r.message && <p className="line-clamp-2 text-[13px] text-muted">{r.message}</p>}
              <div className="mt-2 flex gap-2">
                {[true, false].map((accept) => (
                  <Button
                    key={String(accept)}
                    size="sm"
                    variant={accept ? "primary" : "secondary"}
                    onClick={async () => {
                      const res = await respondConnectionAction(r.id, accept);
                      if (!res.ok) return toast.error(res.error);
                      setDone((d) => [...d, r.id]);
                      router.refresh();
                    }}
                  >
                    {accept ? "Accept" : "Ignore"}
                  </Button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
