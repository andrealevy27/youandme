"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { blockUserAction, unblockUserAction } from "./actions";

/** Controlled confirm dialog for blocking — usable from dropdown menus. */
export function BlockConfirmDialog({
  userId,
  name,
  open,
  onOpenChange,
  onBlocked,
}: {
  userId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlocked?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  function confirm() {
    startTransition(async () => {
      const res = await blockUserAction(userId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name} is blocked.`);
      onOpenChange(false);
      onBlocked?.();
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Block ${name}?`} description="You can unblock them any time from Settings.">
        <ul className="space-y-2 text-sm text-muted">
          <li>They won&apos;t be able to message you, and your conversation will be hidden for both of you.</li>
          <li>You won&apos;t see each other in recommendations, search or profiles.</li>
          <li>They won&apos;t be told that you blocked them.</li>
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} loading={pending}>
            Block
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Block / Unblock toggle with confirmation. `initialBlocked` should come from
 * `hasBlocked(viewerId, userId)` in `@/server/moderation`.
 */
export function BlockButton({
  userId,
  name,
  initialBlocked = false,
  onChange,
  variant = "ghost",
  size = "sm",
  className,
}: {
  userId: string;
  name: string;
  initialBlocked?: boolean;
  onChange?: (blocked: boolean) => void;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = React.useState(initialBlocked);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function unblock() {
    startTransition(async () => {
      const res = await unblockUserAction(userId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBlocked(false);
      onChange?.(false);
      toast.success(`${name} is unblocked.`);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        loading={pending}
        aria-pressed={blocked}
        onClick={() => (blocked ? unblock() : setConfirmOpen(true))}
      >
        <Ban /> {blocked ? "Unblock" : "Block"}
      </Button>
      <BlockConfirmDialog
        userId={userId}
        name={name}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onBlocked={() => {
          setBlocked(true);
          onChange?.(true);
        }}
      />
    </>
  );
}
