"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "./errors";
import { OAuthButtons, type OAuthFlags } from "./oauth-buttons";
import { AuthHeading, FormError, PasswordInput } from "./password-input";

export function LoginForm({ oauth, next, initialError }: { oauth: OAuthFlags; next: string; initialError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: err } = await authClient.signIn.email({ email: email.trim(), password, callbackURL: next });
      if (err) {
        setError(friendlyAuthError(err));
        setPending(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("We couldn't reach You&Me. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to see who's worth meeting today." />
      <div className="space-y-5">
        <OAuthButtons flags={oauth} callbackURL={next} newUserCallbackURL="/onboarding" onError={setError} />
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" className="h-11 w-full" loading={pending} disabled={!email.trim() || !password}>
            Sign in
          </Button>
        </form>
      </div>
      <p className="mt-8 text-center text-[14px] text-muted">
        New to You&amp;Me?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
