import * as React from "react";
import { cn } from "@/lib/utils";

/** A single KPI. `value` of null renders an honest em dash instead of a made-up number. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode | null;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  tone?: "default" | "warning" | "brand";
}) {
  return (
    <div className={cn("rounded-[16px] border border-border bg-card p-4 shadow-soft", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        {icon && <span className="text-subtle [&_svg]:size-4">{icon}</span>}
      </div>
      <p
        className={cn(
          "mt-2 text-[26px] leading-none font-semibold tracking-tight tabular-nums",
          tone === "warning" && "text-warning",
          tone === "brand" && "text-brand-ink",
        )}
      >
        {value === null || value === undefined ? <span className="text-subtle">—</span> : value}
      </p>
      {hint && <p className="mt-2 text-[12.5px] text-subtle">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>;
}
