import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Ticket, TicketX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMarketingContext } from "@/components/marketing/context";
import { findUsableInvite } from "@/server/auth/lifecycle";
import { acceptInviteAction } from "./actions";

export const metadata: Metadata = { title: "You're invited", robots: { index: false } };

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code: raw }, sp, ctx] = await Promise.all([params, searchParams, getMarketingContext()]);
  const code = decodeURIComponent(raw).slice(0, 64);
  const invite = await findUsableInvite(code).catch(() => null);

  return (
    <div className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-lg rounded-[24px] border border-border bg-card p-7 text-center shadow-soft sm:p-10">
        {invite ? (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white">
              <Ticket className="size-6" aria-hidden />
            </span>
            <p className="mt-6 text-[13px] font-medium text-brand-ink">Invitation</p>
            <h1 className="mt-2 text-[34px] leading-tight font-semibold tracking-[-0.035em] sm:text-[40px]">You&apos;re invited.</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-muted">
              Someone thinks you belong on You&amp;Me — the network for building startups. Create your account to meet the people you need.
            </p>
            {ctx.signedIn ? (
              <Button asChild size="lg" className="mt-8 h-12 w-full sm:w-auto sm:px-8">
                <Link href="/home">
                  You&apos;re already a member — open app <ArrowRight />
                </Link>
              </Button>
            ) : (
              <form action={acceptInviteAction} className="mt-8">
                <input type="hidden" name="code" value={invite.code} />
                <Button type="submit" size="lg" className="h-12 w-full sm:w-auto sm:px-8">
                  Accept invite &amp; join <ArrowRight />
                </Button>
              </form>
            )}
            <p className="mt-5 font-mono text-[12px] tracking-wider text-subtle">{invite.code}</p>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface text-muted">
              <TicketX className="size-6" aria-hidden />
            </span>
            <h1 className="mt-6 text-[30px] leading-tight font-semibold tracking-[-0.03em]">
              {sp.limited ? "Please try again in a moment." : "This invite can't be used."}
            </h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
              {sp.limited
                ? "We've seen a lot of attempts from your connection. Wait a few minutes and reload this page."
                : "The code may have expired or already been used. Ask the person who invited you for a new link."}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
              {ctx.showWaitlist ? (
                <Button asChild size="lg" className="h-11">
                  <Link href="/waitlist">Join the waitlist</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="h-11">
                  <Link href="/signup">Create an account</Link>
                </Button>
              )}
              <Button asChild size="lg" variant="secondary" className="h-11">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
