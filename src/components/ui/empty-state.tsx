import * as React from "react";
import { cn } from "@/lib/utils";

/** Every empty screen explains what to do next. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-[16px] border border-dashed border-border-strong px-6 py-12 text-center", className)}>
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink [&_svg]:size-5">{icon}</div>}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "We couldn't load this. Try again.", retry }: { message?: string; retry?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-[16px] border border-danger/30 bg-danger-soft px-5 py-4 text-sm text-danger">
      <p>{message}</p>
      {retry && <div className="mt-3">{retry}</div>}
    </div>
  );
}
