import { MessagesSquare } from "lucide-react";

/** Desktop right pane before a conversation is picked (mobile shows the list instead). */
export default function MessagesIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface text-muted">
        <MessagesSquare className="size-5" aria-hidden />
      </span>
      <p className="text-[15px] font-medium">Pick a conversation</p>
      <p className="mt-1 max-w-xs text-sm text-muted">Choose a thread on the left to pick up where you left off.</p>
    </div>
  );
}
