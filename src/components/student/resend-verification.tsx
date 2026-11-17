"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function ResendVerificationButton({ email }: { email: string }) {
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  async function resend() {
    setPending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/home" });
      if (error) toast.error(error.message ?? "We couldn't send the email. Try again in a minute.");
      else {
        setSent(true);
        toast.success("Confirmation email sent.");
      }
    } finally {
      setPending(false);
    }
  }
  return (
    <Button variant="secondary" onClick={resend} loading={pending} disabled={sent}>
      {sent ? "Sent — check your inbox" : "Resend confirmation email"}
    </Button>
  );
}
