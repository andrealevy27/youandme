"use client";
import * as React from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { SaveTarget } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { toggleSavedAction } from "./actions";

/**
 * Optimistic save toggle for people, consultants and startups.
 * `initialSaved` should come from `isSaved()` / `savedTargetIds()` in `@/server/saved`.
 * `iconOnly` renders a compact round button for cards.
 */
export function SaveButton({
  targetType,
  targetId,
  initialSaved,
  iconOnly = false,
  variant = "secondary",
  size,
  className,
  onChange,
}: {
  targetType: SaveTarget;
  targetId: string;
  initialSaved: boolean;
  iconOnly?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  onChange?: (saved: boolean) => void;
}) {
  const [saved, setSaved] = React.useState(initialSaved);
  const [pending, startTransition] = React.useTransition();

  function toggle(e: React.MouseEvent) {
    // Cards are often links; saving must not navigate.
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await toggleSavedAction(targetType, targetId);
      if (!res.ok) {
        setSaved(!next);
        toast.error(res.error);
        return;
      }
      setSaved(res.data.saved);
      onChange?.(res.data.saved);
      toast.success(res.data.saved ? "Saved" : "Removed from saved", { duration: 1800 });
    });
  }

  return (
    <Button
      type="button"
      variant={iconOnly ? "ghost" : variant}
      size={iconOnly ? "icon-sm" : (size ?? "md")}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      onClick={toggle}
      className={cn(iconOnly && "rounded-full", className)}
    >
      <Bookmark className={cn("transition-colors", saved && "fill-current text-brand")} />
      {!iconOnly && (saved ? "Saved" : "Save")}
    </Button>
  );
}
