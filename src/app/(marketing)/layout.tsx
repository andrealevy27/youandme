import { CookieNotice } from "@/components/marketing/cookie-notice";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { getMarketingContext } from "@/components/marketing/context";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { signedIn, showWaitlist, primaryCta } = await getMarketingContext();
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
