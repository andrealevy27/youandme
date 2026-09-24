import Link from "next/link";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConsultantNotFound() {
  return (
    <EmptyState
      icon={<UserX />}
      title="This consultant isn't available"
      description="The profile may have been removed, isn't public, or the link is wrong."
      action={
        <Button asChild>
          <Link href="/consultants">Browse consultants</Link>
        </Button>
      }
    />
  );
}
