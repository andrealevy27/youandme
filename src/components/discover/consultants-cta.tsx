import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The Consultants tab hands off to the marketplace (owned separately) with the same query. */
export function ConsultantsCta({ q }: { q: string }) {
  const href = q ? `/consultants?q=${encodeURIComponent(q)}` : "/consultants";
  return (
    <div className="flex flex-col items-start gap-4 rounded-[16px] border border-border bg-card p-6 shadow-soft sm:flex-row sm:items-center sm:p-8">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <Briefcase className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] font-semibold tracking-tight">
          {q ? <>Consultants for &ldquo;{q}&rdquo;</> : "Vetted consultants, bookable today"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Growth, fundraising, design, legal and more — with clear prices and real reviews. Browse the marketplace to compare services and book.
        </p>
      </div>
      <Button asChild>
        <Link href={href}>
          Browse consultants <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
