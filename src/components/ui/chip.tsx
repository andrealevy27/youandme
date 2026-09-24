"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Selectable pill used for multi-select questions. Keyboard accessible (it is a button with aria-pressed). */
export function Chip({
  selected,
  onToggle,
  children,
  className,
  size = "md",
}: {
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-all active:scale-[0.97]",
        size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[13px]",
        selected ? "border-foreground bg-ink text-ink-foreground" : "border-border-strong bg-card text-foreground hover:border-foreground/40",
        className,
      )}
    >
      {selected && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

/** Large tappable option card for single/multi choice onboarding questions. */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  multi,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 rounded-[14px] border p-4 text-left transition-all active:scale-[0.99]",
        selected ? "border-foreground bg-card ring-1 ring-foreground" : "border-border bg-card hover:border-border-strong",
      )}
    >
      {icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface text-foreground [&_svg]:size-5">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center border transition-colors",
          multi ? "rounded-[6px]" : "rounded-full",
          selected ? "border-foreground bg-ink text-ink-foreground" : "border-border-strong",
        )}
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}
