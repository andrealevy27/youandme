"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { redeemInviteCodeAction } from "@/app/(auth)/actions";
import { friendlyAuthError } from "./errors";
import { OAuthButtons, type OAuthFlags } from "./oauth-buttons";
import { AuthHeading, FormError, PasswordInput } from "./password-input";
import { MIN_PASSWORD, PasswordStrength } from "./password-strength";

export function SignupForm({
  oauth,
  inviteOnly,
  inviteApplied,
  showWaitlist,
}: {
  oauth: OAuthFlags;
  inviteOnly: boolean;
  inviteApplied: boolean;
  showWaitlist: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const needsCode = inviteOnly && !inviteApplied;

  /** In invite-only mode, validate the code and set the httpOnly cookie before any signup call. */
  async function ensureInvite(): Promise<boolean> {
    if (!needsCode) return true;
    setCodeError(null);
    if (!code.trim()) {
      setCodeError("Enter your invite code to continue.");
      return false;
    }
    const res = await redeemInviteCodeAction({ code });
    if (!res.ok) {
      setCodeError(res.error);
      return false;
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    setPending(true);
    try {
      if (!(await ensureInvite())) return;
      const { error: err } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: "/onboarding" });
      if (err) {
        setError(friendlyAuthError(err));
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("We couldn't reach You&Me. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <AuthHeading
        title="Join You&Me"
        description={inviteOnly ? "You&Me is invite-only while we grow carefully." : "Tell us who you are. We'll help you find who you need."}
      />

      {inviteOnly && inviteApplied && (
        <p className="mb-6 flex items-center gap-2 rounded-[12px] bg-success-soft px-3.5 py-2.5 text-[13.5px] text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Your invite is applied. Welcome in.
        </p>
      )}

      {needsCode && (
        <div className="mb-6 rounded-[14px] border border-border bg-surface p-4">
          <Field label="Invite code" htmlFor="invite" error={codeError ?? undefined}>
            <div className="relative">
              <Ticket className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
              <Input
                id="invite"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. FOUNDER-2026"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="pl-10 font-mono tracking-wide"
                aria-invalid={!!codeError || undefined}
                aria-describedby={codeError ? "invite-error" : undefined}
              />
            </div>
          </Field>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            No code yet?{" "}
            {showWaitlist ? (
              <>
                <Link href="/waitlist" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Join the waitlist
                </Link>{" "}
                and we&apos;ll let you know when a spot opens.
              </>
            ) : (
              "Ask a member for an invite link."
            )}
          </p>
        </div>
      )}

      <div className="space-y-5">
        <OAuthButtons flags={oauth} callbackURL="/onboarding" beforeRedirect={ensureInvite} onError={setError} verb="Sign up" />
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Full name" htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              maxLength={128}
              aria-describedby="password-strength"
            />
            <PasswordStrength value={password} id="password-strength" />
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" className="h-11 w-full" loading={pending} disabled={!name.trim() || !email.trim() || !password}>
            Create account {!pending && <ArrowRight />}
          </Button>
          <p className="text-center text-[12.5px] leading-relaxed text-subtle">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </div>

      <p className="mt-8 text-center text-[14px] text-muted">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
