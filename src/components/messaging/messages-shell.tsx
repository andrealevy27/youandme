"use client";
import * as React from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Two-pane messages layout. Desktop: list left, thread right. Mobile: the list at
 * /messages, and a full-height thread (between the top bar and the tab bar) at /messages/[id].
 */
export function MessagesShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const inThread = segment !== null;
  return (
    <div className="lg:-mt-2 lg:grid lg:h-[calc(100dvh-4.5rem)] lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden lg:rounded-[20px] lg:border lg:border-border lg:bg-card lg:shadow-soft xl:grid-cols-[360px_minmax(0,1fr)]">
      <section
        aria-label="Inbox"
        className={cn("flex min-h-0 flex-col lg:border-r lg:border-border lg:px-4 lg:pt-5", inThread && "hidden lg:flex")}
      >
        <h1 className="mb-4 px-0.5 text-[26px] leading-tight font-semibold tracking-tight lg:text-xl">Messages</h1>
        {list}
      </section>
      <section aria-label="Conversation" className={cn("min-h-0 min-w-0", inThread ? "flex flex-col" : "hidden lg:flex lg:flex-col")}>
        {children}
      </section>
    </div>
  );
}
