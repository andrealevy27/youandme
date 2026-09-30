import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db } from "../db";
import { adminUsers, identityVerifications, platformInvites, profiles, savedCollections, waitlistEntries } from "../db/schema";
import { adminBootstrapEmails } from "../env";
import { getSetting } from "../settings";
import { track } from "../analytics";
import { audit } from "../audit";
import { randomSuffix, slugify } from "@/lib/slug";

export const INVITE_COOKIE = "ym_invite";

export async function findUsableInvite(code: string | undefined) {
  if (!code) return null;
  const [invite] = await db
    .select()
    .from(platformInvites)
    .where(
      and(
        eq(platformInvites.code, code.trim().toUpperCase()),
        lt(platformInvites.uses, platformInvites.maxUses),
        or(isNull(platformInvites.expiresAt), gt(platformInvites.expiresAt, new Date())),
      ),
    )
    .limit(1);
  return invite ?? null;
}

/** Invite-only (and waitlist-only) mode is enforced here, for every signup path (email and OAuth). */
export async function assertSignupAllowed(inviteCode: string | undefined) {
  const [inviteOnly, waitlistOnly] = await Promise.all([getSetting("invite_only"), getSetting("waitlist_only")]);
  if (!inviteOnly && !waitlistOnly) return;
  const invite = await findUsableInvite(inviteCode);
  if (!invite) {
    throw new APIError("FORBIDDEN", {
      message: "You&Me is invite-only right now. Join the waitlist and we'll let you know when a spot opens.",
    });
  }
}

export async function generateHandle(name: string): Promise<string> {
  const base = slugify(name, 24) || "member";
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${randomSuffix(4)}`;
    const [taken] = await db
      .select({ id: profiles.userId })
      .from(profiles)
      .where(sql`lower(${profiles.handle}) = ${candidate}`)
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${randomSuffix(8)}`;
}

/** Create everything a new account needs. Idempotent so retries are safe. */
export async function onUserCreated(user: { id: string; name: string; email: string; image?: string | null }, inviteCode?: string) {
  const handle = await generateHandle(user.name || user.email.split("@")[0] || "member");
  await db
    .insert(profiles)
    .values({ userId: user.id, handle, displayName: user.name || handle, avatarUrl: user.image ?? null })
    .onConflictDoNothing();
  await db.insert(savedCollections).values({ userId: user.id, name: "Saved", isDefault: true }).onConflictDoNothing();

  const invite = await findUsableInvite(inviteCode);
  if (invite) {
    await db.update(platformInvites).set({ uses: sql`${platformInvites.uses} + 1` }).where(eq(platformInvites.id, invite.id));
  }
  await db
    .update(waitlistEntries)
    .set({ status: "joined" })
    .where(eq(sql`lower(${waitlistEntries.email})`, user.email.toLowerCase()));

  if (adminBootstrapEmails.includes(user.email.toLowerCase())) {
    await db.insert(adminUsers).values({ userId: user.id, role: "super_admin" }).onConflictDoNothing();
    await audit({ actorId: null, action: "admin.bootstrap_grant", targetType: "user", targetId: user.id });
  }
  track("signup_completed", user.id, { viaInvite: !!invite });
}

/** Idempotently record a verified signal (email confirmed, LinkedIn account linked). */
export async function recordVerification(userId: string, type: "email" | "linkedin", subject: string | null) {
  const [existing] = await db
    .select({ id: identityVerifications.id })
    .from(identityVerifications)
    .where(and(eq(identityVerifications.userId, userId), eq(identityVerifications.type, type), eq(identityVerifications.status, "verified")))
    .limit(1);
  if (existing) return;
  await db.insert(identityVerifications).values({ userId, type, status: "verified", subject, verifiedAt: new Date() });
}
