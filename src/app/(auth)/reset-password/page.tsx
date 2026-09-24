import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthHeading } from "@/components/auth/password-input";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  if (!token || sp.error) {
    return (
      <div>
        <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
          <LinkIcon className="size-5" aria-hidden />
        </span>
        <div className="mt-5">
          <AuthHeading title="This link has expired" description="Reset links work once and expire after an hour. Request a fresh one and we'll email it right away." />
        </div>
        <Button asChild size="lg" className="-mt-2 h-11 w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
