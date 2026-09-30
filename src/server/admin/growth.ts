import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { platformInvites, profiles, waitlistEntries } from "../db/schema";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { emailLayout, sendEmail, WAITLIST_FOOTER } from "../email";
import { env } from "../env";
import type { Viewer } from "../auth/session";
import { ADMIN_PAGE_SIZE, escapeHtml, generateInviteCode, pageOffset } from "./utils";

export const WAITLIST_STATUSES = ["waiting", "invited", "joined"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export async function listWaitlist(opts: { status: WaitlistStatus; page: number }) {
  const where = eq(waitlistEntries.status, opts.status);
  const [rows, total, counts] = await Promise.all([
    db
      .select({
        id: waitlistEntries.id,
        email: waitlistEntries.email,
        name: waitlistEntries.name,
        intent: waitlistEntries.intent,
        note: waitlistEntries.note,
        phone: waitlistEntries.phone,
        school: waitlistEntries.school,
        source: waitlistEntries.source,
        sourceDetail: waitlistEntries.sourceDetail,
        status: waitlistEntries.status,
        createdAt: waitlistEntries.createdAt,
        inviteCode: platformInvites.code,
      })
      .from(waitlistEntries)
      .leftJoin(platformInvites, eq(platformInvites.id, waitlistEntries.inviteId))
      .where(where)
      .orderBy(opts.status === "waiting" ? waitlistEntries.createdAt : desc(waitlistEntries.createdAt), desc(waitlistEntries.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(opts.page)),
    db.select({ n: count() }).from(waitlistEntries).where(where),
    db.select({ status: waitlistEntries.status, n: count() }).from(waitlistEntries).groupBy(waitlistEntries.status),
  ]);
  const byStatus = Object.fromEntries(WAITLIST_STATUSES.map((s) => [s, 0])) as Record<WaitlistStatus, number>;
  for (const c of counts) byStatus[c.status] = c.n;
  return { rows, total: total[0]?.n ?? 0, byStatus };
}

/** Every entry, oldest first, for the admin CSV export. */
export async function exportWaitlist() {
  return db
    .select({
      email: waitlistEntries.email,
      name: waitlistEntries.name,
      intent: waitlistEntries.intent,
      note: waitlistEntries.note,
      phone: waitlistEntries.phone,
      school: waitlistEntries.school,
      source: waitlistEntries.source,
      sourceDetail: waitlistEntries.sourceDetail,
      status: waitlistEntries.status,
      createdAt: waitlistEntries.createdAt,
      inviteCode: platformInvites.code,
    })
    .from(waitlistEntries)
    .leftJoin(platformInvites, eq(platformInvites.id, waitlistEntries.inviteId))
    .orderBy(asc(waitlistEntries.createdAt), asc(waitlistEntries.id));
}

export async function listInvites(page: number) {
  const [rows, total] = await Promise.all([
    db
      .select({
        id: platformInvites.id,
        code: platformInvites.code,
        email: platformInvites.email,
        note: platformInvites.note,
        maxUses: platformInvites.maxUses,
        uses: platformInvites.uses,
        expiresAt: platformInvites.expiresAt,
        createdAt: platformInvites.createdAt,
        createdByName: profiles.displayName,
      })
      .from(platformInvites)
      .leftJoin(profiles, eq(profiles.userId, platformInvites.createdById))
      .orderBy(desc(platformInvites.createdAt), desc(platformInvites.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(page)),
    db.select({ n: count() }).from(platformInvites),
  ]);
  return { rows, total: total[0]?.n ?? 0 };
}

export function inviteUrl(code: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/invite/${code}`;
}

async function insertInvite(values: { code?: string; email?: string | null; note?: string | null; maxUses: number; expiresAt: Date | null; createdById: string }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = (values.code ?? generateInviteCode()).toUpperCase();
    const rows = await db
      .insert(platformInvites)
      .values({ ...values, code })
      .onConflictDoNothing({ target: platformInvites.code })
      .returning();
    if (rows[0]) return rows[0];
    if (values.code) throw new AppError("CONFLICT", `The code ${code} already exists.`);
  }
  throw new AppError("CONFLICT", "Couldn't generate a unique invite code. Try again.");
}

export async function createInvite(
  actor: Viewer,
  input: { code?: string; email?: string; note?: string; maxUses: number; expiresInDays: number | null },
) {
  const invite = await insertInvite({
    code: input.code,
    email: input.email || null,
    note: input.note || null,
    maxUses: input.maxUses,
    expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
    createdById: actor.userId,
  });
  await audit({
    actorId: actor.userId,
    action: "invite.created",
    targetType: "platform_invite",
    targetId: invite.id,
    metadata: { code: invite.code, maxUses: invite.maxUses, expiresAt: invite.expiresAt?.toISOString() ?? null, note: invite.note },
  });
  return invite;
}

export async function revokeInvite(actor: Viewer, id: string) {
  const res = await db
    .update(platformInvites)
    .set({ expiresAt: new Date() })
    .where(and(eq(platformInvites.id, id), sql`(${platformInvites.expiresAt} is null or ${platformInvites.expiresAt} > now())`))
    .returning({ code: platformInvites.code });
  if (!res[0]) throw new AppError("CONFLICT", "This invite has already expired or been revoked.");
  await audit({ actorId: actor.userId, action: "invite.revoked", targetType: "platform_invite", targetId: id, metadata: { code: res[0].code } });
}

/** Creates a single-use code, marks the entry invited and emails the link. */
export async function inviteFromWaitlist(actor: Viewer, entryId: string) {
  const [entry] = await db.select().from(waitlistEntries).where(eq(waitlistEntries.id, entryId)).limit(1);
  if (!entry) throw notFound("That waitlist entry");
  if (entry.status !== "waiting") throw new AppError("CONFLICT", `This person is already ${entry.status}.`);

  const invite = await insertInvite({
    email: entry.email,
    note: `Waitlist: ${entry.name ?? entry.email}`,
    maxUses: 1,
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    createdById: actor.userId,
  });
  await db.update(waitlistEntries).set({ status: "invited", inviteId: invite.id }).where(eq(waitlistEntries.id, entry.id));

  const url = inviteUrl(invite.code);
  const greeting = entry.name ? `Hi ${entry.name.split(" ")[0]},` : "Hi,";
  await sendEmail({
    to: entry.email,
    subject: "Your You&Me invite is here",
    text: `${greeting}\n\nA spot opened up on You&Me. Use your personal invite to join: ${url}\n\nYour code: ${invite.code} (valid for 30 days).`,
    html: emailLayout(
      "Your You&Me invite is here",
      `${escapeHtml(greeting)}<br/><br/>A spot opened up. Use your personal invite to create your account — it's valid for 30 days.<br/><br/>Your code: <strong>${invite.code}</strong>`,
      { label: "Accept invite", url },
      WAITLIST_FOOTER,
    ),
  });
  await audit({
    actorId: actor.userId,
    action: "waitlist.invited",
    targetType: "waitlist_entry",
    targetId: entry.id,
    metadata: { email: entry.email, inviteId: invite.id, code: invite.code },
  });
  return invite;
}

export const MAX_WAVE_SIZE = 100;

/** Invites the longest-waiting people, one personal code and email each. */
export async function inviteNextFromWaitlist(actor: Viewer, count: number) {
  const size = Math.max(1, Math.min(MAX_WAVE_SIZE, Math.floor(count)));
  const next = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.status, "waiting"))
    .orderBy(asc(waitlistEntries.createdAt), asc(waitlistEntries.id))
    .limit(size);
  if (!next.length) throw new AppError("CONFLICT", "No one is waiting right now.");
  let invited = 0;
  for (const entry of next) {
    try {
      await inviteFromWaitlist(actor, entry.id);
      invited += 1;
    } catch (err) {
      // Another admin invited this person in the meantime; keep going.
      if (err instanceof AppError && err.code === "CONFLICT") continue;
      throw err;
    }
  }
  return { invited };
}
