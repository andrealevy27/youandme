"use client";
import * as React from "react";
import { Tooltip as T } from "radix-ui";

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content sideOffset={6} className="z-50 max-w-64 rounded-[8px] bg-ink px-2.5 py-1.5 text-xs text-ink-foreground shadow-float">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
