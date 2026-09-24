import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requireViewerPage } from "@/server/auth/session";
import { db } from "@/server/db";
import { account, profiles } from "@/server/db/schema";
import { listBlocked } from "@/server/moderation";
import { listMyVerifications } from "@/server/verification";
import { NotificationPreferences } from "@/components/notifications/preferences";
import {
  BlockedList,
  ChangePasswordForm,
  DangerZone,
  UniversityVerification,
  VisibilityForm,
} from "@/components/settings/settings-sections";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VERIFICATION_LABELS } from "@/lib/domain";

export const metadata: Metadata = { title: "Settings" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card>
        <CardContent>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          <div className="mt-5">{children}</div>
        </CardContent>
      </Card>
    </section>
  );
}

const NAV = [
  ["account", "Account"],
  ["notifications", "Notifications"],
  ["privacy", "Privacy"],
  ["verification", "Verification"],
  ["blocked", "Blocked"],
  ["data", "Your data"],
] as const;

export default async function SettingsPage() {
  const viewer = await requireViewerPage();
  const [[profile], accounts, blocked, verifications] = await Promise.all([
    db.select({ visibility: profiles.visibility }).from(profiles).where(eq(profiles.userId, viewer.userId)),
    db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, viewer.userId)),
    listBlocked(viewer.userId),
    listMyVerifications(viewer.userId),
  ]);
  const hasPassword = accounts.some((a) => a.providerId === "credential");
  const verified = verifications.filter((v) => v.status === "verified");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <nav className="scrollbar-none -mx-4 mb-6 flex gap-1 overflow-x-auto px-4" aria-label="Settings sections">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium text-muted hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>
      <div className="space-y-5">
        <Section id="account" title="Account" description={`Signed in as ${viewer.email}.`}>
          <p className="mb-4 text-sm text-muted">
            Sign-in methods: {accounts.map((a) => (a.providerId === "credential" ? "Email & password" : a.providerId[0]!.toUpperCase() + a.providerId.slice(1))).join(", ") || "—"}
          </p>
          {hasPassword ? <ChangePasswordForm /> : <p className="text-sm text-muted">You sign in with a connected account, so there&apos;s no password to change.</p>}
        </Section>
        <Section id="notifications" title="Notifications" description="Choose what reaches you, and where. Account and security notices are always sent.">
          <NotificationPreferences />
        </Section>
        <Section id="privacy" title="Privacy & visibility" description="Control who can find you. Hidden profiles never appear in search, recommendations or You&Me AI results.">
          <VisibilityForm initial={profile?.visibility ?? "public"} />
        </Section>
        <Section id="verification" title="Verification" description="Badges only claim what was actually checked.">
          {verified.length > 0 && (
            <ul className="mb-5 space-y-1.5 text-sm">
              {verified.map((v, i) => (
                <li key={i}>
                  ✓ {VERIFICATION_LABELS[v.type]}
                  {v.subject && v.type === "university_email" ? ` (${v.subject})` : ""}
                </li>
              ))}
            </ul>
          )}
          <UniversityVerification />
        </Section>
        <Section id="blocked" title="Blocked people" description="Blocked people can't see your profile or message you, and you won't see them.">
          <BlockedList people={blocked.map((b) => ({ userId: b.userId, name: b.name, handle: b.handle, avatarUrl: b.avatarUrl }))} />
        </Section>
        <Section id="data" title="Your data" description="Download everything we hold about you, or delete your account.">
          <Button variant="secondary" asChild>
            <a href="/api/v1/me/export" download>
              Download my data (JSON)
            </a>
          </Button>
          <DangerZone />
        </Section>
      </div>
    </div>
  );
}
