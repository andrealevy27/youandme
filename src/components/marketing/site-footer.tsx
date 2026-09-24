import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export function SiteFooter({ showWaitlist }: { showWaitlist: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border px-5 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-[14px] leading-relaxed text-muted">The network for building startups.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-3 text-[14px] sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-medium tracking-wide text-subtle uppercase">Product</p>
            <Link href="/#how" className="text-muted hover:text-foreground">How it works</Link>
            <Link href="/#cofounders" className="text-muted hover:text-foreground">Cofounders</Link>
            <Link href="/#consultants" className="text-muted hover:text-foreground">Consultants</Link>
            <Link href="/#ai" className="text-muted hover:text-foreground">AI</Link>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-medium tracking-wide text-subtle uppercase">Account</p>
            <Link href="/signup" className="text-muted hover:text-foreground">Join</Link>
            <Link href="/login" className="text-muted hover:text-foreground">Sign in</Link>
            {showWaitlist && <Link href="/waitlist" className="text-muted hover:text-foreground">Waitlist</Link>}
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-medium tracking-wide text-subtle uppercase">Legal</p>
            <Link href="/privacy" className="text-muted hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="text-muted hover:text-foreground">Terms</Link>
          </div>
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-border py-6 text-[13px] text-subtle sm:flex-row sm:justify-between">
        <p>© {year} You&amp;Me. All rights reserved.</p>
        <p>The human layer of company building.</p>
      </div>
    </footer>
  );
}
