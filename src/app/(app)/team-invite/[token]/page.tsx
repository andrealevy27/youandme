import type { Metadata } from "next";
import Link from "next/link";
import { requireViewerPage } from "@/server/auth/session";
import { getInviteByToken } from "@/server/startups";
import { InviteResponse } from "@/components/startups/invite-response";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STARTUP_MEMBER_ROLE_LABELS } from "@/lib/domain";

export const metadata: Metadata = { title: "Team invite" };

export default async function TeamInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const viewer = await requireViewerPage();
  const { token } = await params;
  const row = await getInviteByToken(token);
  const valid =
    row &&
    row.invite.status === "pending" &&
    row.invite.expiresAt > new Date() &&
    (row.invite.invitedUserId === viewer.userId || row.invite.email?.toLowerCase() === viewer.email.toLowerCase());
  return (
    <div className="mx-auto max-w-md pt-6">
      <Card>
        <CardContent className="text-center">
          {valid && row ? (
            <>
              <Avatar name={row.startup.name} src={row.startup.logoUrl} size="xl" rounded="xl" className="mx-auto" />
              <h1 className="mt-5 text-xl font-semibold tracking-tight">Join {row.startup.name}</h1>
              <p className="mt-2 text-sm text-muted">
                You&apos;ve been invited as {STARTUP_MEMBER_ROLE_LABELS[row.invite.role].toLowerCase()}.
                {row.startup.tagline ? ` ${row.startup.tagline}` : ""}
              </p>
              <div className="mt-6 flex justify-center">
                <InviteResponse token={token} />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">This invite isn&apos;t available</h1>
              <p className="mt-2 text-sm text-muted">It may have expired, been revoked, or been sent to a different email address than {viewer.email}.</p>
              <Button className="mt-6" asChild>
                <Link href="/startup">Go to your startups</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
