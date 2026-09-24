import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ConversationNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
      <p className="text-[15px] font-medium">Conversation not found</p>
      <p className="mt-1 max-w-xs text-sm text-muted">It may have been removed, or you&apos;re not part of it.</p>
      <Button asChild className="mt-5" size="sm" variant="secondary">
        <Link href="/messages">Back to messages</Link>
      </Button>
    </div>
  );
}
