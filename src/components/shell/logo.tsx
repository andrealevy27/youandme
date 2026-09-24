import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="ym-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="16" r="8.5" fill="none" stroke="var(--foreground)" strokeWidth="2.6" />
      <circle cx="20" cy="16" r="8.5" fill="none" stroke="url(#ym-g)" strokeWidth="2.6" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="You&Me home">
      <LogoMark />
      <span className="text-[17px]">You&amp;Me</span>
    </Link>
  );
}
