import Link from "next/link";
import { Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { env } from "@/server/env";

/**
 * In student mode, features outside the campus-cofounder product show a "Coming soon"
 * page instead. With STUDENT_MODE off, the original feature renders unchanged.
 */
export function StudentModeGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  if (!env.STUDENT_MODE) return <>{children}</>;
  return (
    <EmptyState
      className="mt-6"
      icon={<Hourglass />}
      title={`${feature} — coming soon`}
      description="FoundMate is focused on helping student founders find each other first. This part of the product isn't open yet."
      action={
        <Button asChild>
          <Link href="/matches">See your matches</Link>
        </Button>
      }
    />
  );
}
