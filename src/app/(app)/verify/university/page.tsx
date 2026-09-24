import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { confirmUniversityVerification } from "@/server/verification";
import { AppError } from "@/server/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Verify university email" };

export default async function VerifyUniversityPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const viewer = await requireViewerPage();
  const { token } = await searchParams;
  let message: string;
  let ok = false;
  try {
    if (!token) throw new AppError("VALIDATION", "This link is missing its token.");
    const { domain } = await confirmUniversityVerification(viewer.userId, token);
    ok = true;
    message = `Confirmed — you have access to an email address at ${domain}.`;
  } catch (err) {
    message = err instanceof AppError ? err.message : "We couldn't confirm this link. Try again from Settings.";
  }
  return (
    <div className="mx-auto max-w-md pt-6">
      <Card>
        <CardContent className="text-center">
          <ShieldCheck className={ok ? "mx-auto size-10 text-brand" : "mx-auto size-10 text-subtle"} aria-hidden />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">{ok ? "University email confirmed" : "Couldn't verify"}</h1>
          <p className="mt-2 text-sm text-muted">{message}</p>
          <Button className="mt-6" asChild>
            <Link href="/settings#verification">Back to settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
