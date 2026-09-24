import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "./mobile-menu";

export const NAV_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#cofounders", label: "Cofounders" },
  { href: "/#consultants", label: "Consultants" },
  { href: "/#ai", label: "AI" },
] as const;

export function SiteNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 px-5 sm:px-8">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
        <Logo />
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-[8px] px-3 py-2 text-[14px] text-muted transition-colors hover:text-foreground">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />
          {signedIn ? (
            <Button asChild size="sm" className="h-9 px-4">
              <Link href="/home">
                Open app <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden h-9 px-3 sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="h-9 px-4">
                <Link href="/signup">Join You&amp;Me</Link>
              </Button>
            </>
          )}
          <MobileMenu links={NAV_LINKS} signedIn={signedIn} />
        </div>
      </nav>
    </header>
  );
}
