import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared friendly 404 body used by the global and route-group not-found pages. */
export function NotFoundContent({ compact = false, homeHref = "/" }: { compact?: boolean; homeHref?: string }) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center text-center", compact ? "py-6" : "px-5 py-28 sm:py-36")}>
      <p className="font-mono text-[13px] tracking-widest text-subtle">404</p>
      <h1 className="mt-4 text-[32px] leading-tight font-semibold tracking-[-0.03em] sm:text-[40px]">This page doesn&apos;t exist.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">The link may be broken, or the page may have moved. Let&apos;s get you back on track.</p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="h-11">
          <Link href={homeHref}>
            <ArrowLeft /> Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
}
