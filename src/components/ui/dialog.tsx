"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Centered modal on desktop, bottom sheet on mobile. */
export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof D.Content> & { title: string; description?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-up_200ms_ease]" />
      <D.Content
        className={cn(
          "fixed z-50 w-full border border-border bg-elevated shadow-float focus:outline-none",
          "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[22px] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px]",
          "data-[state=open]:animate-fade-up",
          className,
        )}
        {...props}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="-mt-1 -mr-2 rounded-full p-2 text-muted hover:bg-surface hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
