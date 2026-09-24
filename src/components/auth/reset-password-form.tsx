"use client";
import * as React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "./errors";
import { AuthHeading, FormError, PasswordInput } from "./password-input";
import { MIN_PASSWORD, PasswordStrength } from "./password-strength";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setPending(true);
    try {
      const { error: err } = await authClient.resetPassword({ newPassword: password, token });
      if (err) setError(friendlyAuthError(err));
      else setDone(true);
    } catch {
      setError("We couldn't reach You&Me. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div>
        <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>
        <div className="mt-5">
          <AuthHeading title="Password updated" description="You can now sign in with your new password." />
        </div>
        <Button asChild size="lg" className="-mt-2 h-11 w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Choose a new password" description="Make it at least 10 characters. You'll use it to sign in from now on." />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password">
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
        <Field label="Confirm password" htmlFor="confirm">
          <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="h-11 w-full" loading={pending} disabled={!password || !confirm}>
          Update password
        </Button>
      </form>
    </>
  );
}
