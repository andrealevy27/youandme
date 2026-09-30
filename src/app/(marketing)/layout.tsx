import Link from "next/link";
import { CookieNotice } from "@/components/marketing/cookie-notice";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { getMarketingContext } from "@/components/marketing/context";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { signedIn, showWaitlist, waitlistOnlyView, primaryCta } = await getMarketingContext();
  if (waitlistOnlyView) {
    // Pre-launch: just the brand, the page and the legal links.
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="px-5 sm:px-8">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
            <Logo />
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="px-5 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-[12.5px] text-subtle">
            <p>© {new Date().getFullYear()} You&amp;Me</p>
            <nav aria-label="Legal" className="flex gap-4">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </nav>
          </div>
        </footer>
        <CookieNotice />
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav signedIn={signedIn} cta={primaryCta} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter showWaitlist={showWaitlist} />
      <CookieNotice />
    </div>
  );
}
