"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { AuthHeading, FormError } from "./password-input";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: err } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
      // Never reveal whether an account exists — only surface rate limiting.
      if (err?.status === 429) setError("Too many requests. Please wait a few minutes and try again.");
      else setSent(true);
    } catch {
      setError("We couldn't reach You&Me. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div>
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <div className="mt-5">
          <AuthHeading
            title="Check your inbox"
            description={
              <>
                If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, we&apos;ve sent a link to reset your
                password. It expires in one hour.
              </>
            }
          />
        </div>
        <div className="-mt-2 flex flex-col gap-2">
          <Button asChild variant="secondary" size="lg" className="h-11">
            <Link href="/login">Back to sign in</Link>
          </Button>
          <Button variant="ghost" size="lg" className="h-11 text-muted" onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password" description="Enter the email you use for You&Me and we'll send you a reset link." />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="h-11 w-full" loading={pending} disabled={!email.trim()}>
          Send reset link
        </Button>
      </form>
      <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to sign in
      </Link>
    </>
  );
}
