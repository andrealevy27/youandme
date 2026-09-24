"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { friendlyAuthError } from "./errors";

export type OAuthFlags = { google: boolean; apple: boolean; linkedin: boolean };
type Provider = keyof OAuthFlags;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.94 10.94 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.37 12.64c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.66zM14.1 5.9c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.1 9.4H4.9v9.7h2.2V9.4zM6 5.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm13.1 8.3c0-2.6-1.4-4.3-3.6-4.3-1.3 0-2.1.7-2.5 1.3V9.4h-2.1v9.7h2.2v-5c0-1.3.3-2.6 1.9-2.6s1.7 1.5 1.7 2.7v4.9h2.2l.2-5.6z"
      />
    </svg>
  );
}

const providers: { id: Provider; label: string; Icon: () => React.ReactElement }[] = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "apple", label: "Apple", Icon: AppleIcon },
  { id: "linkedin", label: "LinkedIn", Icon: LinkedInIcon },
];

/** Renders only the providers that are actually configured on the server. */
export function OAuthButtons({
  flags,
  callbackURL,
  newUserCallbackURL,
  beforeRedirect,
  onError,
  verb = "Continue",
}: {
  flags: OAuthFlags;
  callbackURL: string;
  newUserCallbackURL?: string;
  /** Runs first (e.g. redeem an invite code). Return false to abort. */
  beforeRedirect?: () => Promise<boolean>;
  onError: (message: string) => void;
  verb?: string;
}) {
  const [pending, setPending] = React.useState<Provider | null>(null);
  const enabled = providers.filter((p) => flags[p.id]);
  if (enabled.length === 0) return null;

  async function go(provider: Provider) {
    setPending(provider);
    try {
      if (beforeRedirect && !(await beforeRedirect())) {
        setPending(null);
        return;
      }
      const res = await authClient.signIn.social({ provider, callbackURL, newUserCallbackURL, errorCallbackURL: "/login" });
      if (res?.error) {
        onError(friendlyAuthError(res.error));
        setPending(null);
      }
    } catch {
      onError("We couldn't reach the sign-in provider. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        {enabled.map(({ id, label, Icon }) => (
          <Button key={id} type="button" variant="secondary" size="lg" className="h-11 w-full text-[14px]" loading={pending === id} disabled={!!pending} onClick={() => go(id)}>
            {pending !== id && <Icon />}
            {verb} with {label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[12px] text-subtle" role="separator">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
