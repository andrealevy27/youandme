import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap [&_svg]:size-3.5", {
  variants: {
    variant: {
      neutral: "bg-surface text-muted border border-border",
      brand: "bg-brand-soft text-brand-ink",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      outline: "border border-border-strong text-foreground",
    },
    size: { sm: "h-6 px-2.5 text-xs", md: "h-7 px-3 text-[13px]" },
  },
  defaultVariants: { variant: "neutral", size: "sm" },
});

export function Badge({ className, variant, size, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/** Clearly labels seeded demo content so it is never mistaken for a real member. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={className} title="Demo data for development — not a real member">
      Demo
    </Badge>
  );
}
