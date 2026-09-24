import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  consultantCategories,
  industries,
  needSkills,
  needs,
  openRoles,
  profiles,
  skills,
  startupIndustries,
  startupInvites,
  startupMembers,
  startups,
  user as userTable,
} from "../db/schema";
import { AppError, forbidden, notFound } from "../errors";
import { canOnStartup, type StartupAction, type StartupMembership } from "../authz/startup";
import { notify } from "../notifications";
import { emailLayout, sendEmail } from "../email";
import { env } from "../env";
import { audit } from "../audit";
import { track } from "../analytics";
import { enforceRateLimit } from "../rate-limit";
import { getPersonSummaries } from "../people";
import {
  BUSINESS_MODELS,
  COMMITMENTS,
  FUNDING_STATUSES,
  NEED_TYPES,
  STARTUP_MEMBER_ROLES,
  STARTUP_MEMBER_ROLE_LABELS,
  STARTUP_STAGES,
  WORK_MODES,
} from "@/lib/domain";
import { randomSuffix, slugify } from "@/lib/slug";
import { safeUrl } from "@/lib/utils";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const url = z
  .string()
  .trim()
  .max(300)
  .transform((v, ctx) => {
    if (!v) return null;
    const ok = safeUrl(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!ok) {
      ctx.addIssue({ code: "custom", message: "Enter a valid link." });
      return z.NEVER;
    }
    return ok;
  })
  .nullable()
  .optional();

export const startupInputSchema = z.object({
  name: z.string().trim().min(1, "Name your startup.").max(80),
  tagline: text(140),
  description: text(2000),
  problem: text(1200),
  solution: text(1200),
  stage: z.enum(STARTUP_STAGES),
  businessModel: z.enum(BUSINESS_MODELS).nullable().optional(),
  foundedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  location: text(100),
  workMode: z.enum(WORK_MODES).nullable().optional(),
  websiteUrl: url,
  pitchDeckUrl: url,
  logoUrl: z.string().max(500).nullable().optional(),
  traction: text(1200),
  fundingStatus: z.enum(FUNDING_STATUSES).nullable().optional(),
  fundingRaisedCents: z.number().int().min(0).max(10_000_000_000_00).nullable().optional(),
  teamSize: z.number().int().min(1).max(10_000).nullable().optional(),
  status: z.enum(["active", "paused", "acquired", "shut_down"]).optional(),
  visibility: z.enum(["public", "members", "hidden"]).optional(),
  industryIds: z.array(z.string().uuid()).max(5).optional(),
});
export type StartupInput = z.input<typeof startupInputSchema>;

export async function getMembership(userId: string, startupId: string): Promise<StartupMembership> {
  const [m] = await db
    .select({ role: startupMembers.role, isAdmin: startupMembers.isAdmin })
    .from(startupMembers)
    .where(and(eq(startupMembers.userId, userId), eq(startupMembers.startupId, startupId), isNull(startupMembers.removedAt)))
    .limit(1);
  return m ?? null;
}

export async function assertCan(userId: string, startupId: string, action: StartupAction) {
  const membership = await getMembership(userId, startupId);
  if (!canOnStartup(membership, action)) throw forbidden();
  return membership!;
}

async function uniqueSlug(name: string) {
  const base = slugify(name, 40) || "startup";
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${randomSuffix(3)}`;
    const [taken] = await db.select({ id: startups.id }).from(startups).where(sql`lower(${startups.slug}) = ${candidate}`).limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${randomSuffix(6)}`;
}

export async function createStartup(userId: string, raw: StartupInput) {
  const { industryIds, ...data } = startupInputSchema.parse(raw);
  const slug = await uniqueSlug(data.name);
  const startup = await db.transaction(async (tx) => {
    const [s] = await tx.insert(startups).values({ ...data, slug, createdById: userId, teamSize: data.teamSize ?? 1 }).returning();
    await tx.insert(startupMembers).values({ startupId: s!.id, userId, role: "founder", title: "Founder", isAdmin: true });
    if (industryIds?.length) await tx.insert(startupIndustries).values(industryIds.map((industryId) => ({ startupId: s!.id, industryId })));
    return s!;
  });
  track("startup_created", userId, { stage: startup.stage });
  return startup;
}

export async function updateStartup(userId: string, startupId: string, raw: Partial<StartupInput>) {
  await assertCan(userId, startupId, "edit");
  const { industryIds, ...data } = startupInputSchema.partial().parse(raw);
  await db.transaction(async (tx) => {
    if (Object.keys(data).length) await tx.update(startups).set(data).where(eq(startups.id, startupId));
    if (industryIds) {
      await tx.delete(startupIndustries).where(eq(startupIndustries.startupId, startupId));
      if (industryIds.length) await tx.insert(startupIndustries).values(industryIds.map((industryId) => ({ startupId, industryId })));
    }
  });
}

export async function deleteStartup(userId: string, startupId: string) {
  const m = await assertCan(userId, startupId, "manage_settings");
  if (m.role !== "founder") throw forbidden("Only founders can delete a startup.");
  await db.update(startups).set({ deletedAt: new Date(), visibility: "hidden" }).where(eq(startups.id, startupId));
  await audit({ actorId: userId, action: "startup.delete", targetType: "startup", targetId: startupId });
}

export async function listMyStartups(userId: string) {
  return db
    .select({ startup: startups, role: startupMembers.role, isAdmin: startupMembers.isAdmin, title: startupMembers.title })
    .from(startupMembers)
    .innerJoin(startups, eq(startups.id, startupMembers.startupId))
    .where(and(eq(startupMembers.userId, userId), isNull(startupMembers.removedAt), isNull(startups.deletedAt)))
    .orderBy(desc(startupMembers.isAdmin), asc(startupMembers.joinedAt));
}

export async function getPrimaryStartup(userId: string) {
  const [first] = await listMyStartups(userId);
  return first ?? null;
}

/** Startup page data. Private sections only for members; hidden startups only for members. */
export async function getStartupBySlug(viewerId: string, slug: string) {
  const [s] = await db
    .select()
    .from(startups)
    .where(and(sql`lower(${startups.slug}) = ${slug.toLowerCase()}`, isNull(startups.deletedAt)))
    .limit(1);
  if (!s) return null;
  const membership = await getMembership(viewerId, s.id);
  if (s.visibility !== "public" && !membership) return null;

  const [industryRows, memberRows, needRows, roleRows] = await Promise.all([
    db
      .select({ id: industries.id, name: industries.name, slug: industries.slug })
      .from(startupIndustries)
      .innerJoin(industries, eq(industries.id, startupIndustries.industryId))
      .where(eq(startupIndustries.startupId, s.id)),
    db
      .select()
      .from(startupMembers)
      .innerJoin(profiles, eq(profiles.userId, startupMembers.userId))
      .where(and(eq(startupMembers.startupId, s.id), isNull(startupMembers.removedAt), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
      .orderBy(asc(startupMembers.joinedAt)),
    listNeedsForStartup(s.id, { includeClosed: !!membership }),
    db
      .select()
      .from(openRoles)
      .where(and(eq(openRoles.startupId, s.id), membership ? undefined : eq(openRoles.isOpen, true)))
      .orderBy(desc(openRoles.createdAt)),
  ]);
  const people = await getPersonSummaries(memberRows.map((m) => m.startup_members.userId));
  const members = memberRows.map((m) => ({
    ...m.startup_members,
    person: people.find((p) => p.userId === m.startup_members.userId)!,
  }));
  const pendingInvites = membership && canOnStartup(membership, "invite_members")
    ? await db
        .select()
        .from(startupInvites)
        .where(and(eq(startupInvites.startupId, s.id), eq(startupInvites.status, "pending")))
        .orderBy(desc(startupInvites.createdAt))
    : [];
  return { startup: s, industries: industryRows, members, needs: needRows, openRoles: roleRows, membership, pendingInvites };
}

// ── Team & invites ────────────────────────────────────────────────────────────

export const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    userId: z.string().optional(),
    role: z.enum(STARTUP_MEMBER_ROLES),
    makeAdmin: z.boolean().default(false),
  })
  .refine((v) => v.email || v.userId, "Enter an email or pick a person.");

export async function inviteMember(actorId: string, startupId: string, raw: z.input<typeof inviteSchema>) {
  await assertCan(actorId, startupId, "invite_members");
  enforceRateLimit("invite", actorId);
  const data = inviteSchema.parse(raw);
  const [s] = await db.select().from(startups).where(eq(startups.id, startupId));
  if (!s) throw notFound("Startup");

  let invitedUserId = data.userId ?? null;
  let email = data.email ?? null;
  if (!invitedUserId && email) {
    const [u] = await db.select({ id: userTable.id }).from(userTable).where(eq(sql`lower(${userTable.email})`, email)).limit(1);
    invitedUserId = u?.id ?? null;
  }
  if (invitedUserId) {
    if (await getMembership(invitedUserId, startupId)) throw new AppError("CONFLICT", "They're already on the team.");
    if (!email) {
      const [u] = await db.select({ email: userTable.email }).from(userTable).where(eq(userTable.id, invitedUserId));
      email = u?.email ?? null;
    }
  }
  const token = crypto.randomUUID().replace(/-/g, "") + randomSuffix(8);
  const [invite] = await db
    .insert(startupInvites)
    .values({
      startupId,
      email,
      invitedUserId,
      role: data.role,
      makeAdmin: data.makeAdmin,
      token,
      invitedById: actorId,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    })
    .returning();
  const [inviter] = await db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.userId, actorId));
  const link = `/team-invite/${token}`;
  const title = `${inviter?.name ?? "A founder"} invited you to join ${s.name}`;
  const body = `You've been invited as ${STARTUP_MEMBER_ROLE_LABELS[data.role].toLowerCase()} on You&Me.`;
  if (invitedUserId) {
    await notify({ userId: invitedUserId, type: "startup_invite", title, body, href: link, actorId });
  } else if (email) {
    await sendEmail({
      to: email,
      subject: title,
      text: `${body}\n\n${env.NEXT_PUBLIC_APP_URL}${link}`,
      html: emailLayout(title, body, { label: "View invite", url: `${env.NEXT_PUBLIC_APP_URL}${link}` }),
    });
  }
  track("invite_sent", actorId, { role: data.role, existingUser: !!invitedUserId });
  return invite!;
}

export async function getInviteByToken(token: string) {
  const [row] = await db
    .select({ invite: startupInvites, startup: startups })
    .from(startupInvites)
    .innerJoin(startups, eq(startups.id, startupInvites.startupId))
    .where(eq(startupInvites.token, token))
    .limit(1);
  return row ?? null;
}

export async function respondToInvite(userId: string, email: string, token: string, accept: boolean) {
  const row = await getInviteByToken(token);
  if (!row || row.invite.status !== "pending") throw new AppError("NOT_FOUND", "This invite is no longer valid.");
  if (row.invite.expiresAt < new Date()) {
    await db.update(startupInvites).set({ status: "expired" }).where(eq(startupInvites.id, row.invite.id));
    throw new AppError("VALIDATION", "This invite has expired. Ask for a new one.");
  }
  const addressedToMe = row.invite.invitedUserId === userId || (!!row.invite.email && row.invite.email.toLowerCase() === email.toLowerCase());
  if (!addressedToMe) throw forbidden("This invite was sent to a different account.");
  if (!accept) {
    await db.update(startupInvites).set({ status: "declined" }).where(eq(startupInvites.id, row.invite.id));
    return { startup: row.startup, accepted: false };
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(startupMembers)
      .values({ startupId: row.invite.startupId, userId, role: row.invite.role, isAdmin: row.invite.makeAdmin, title: STARTUP_MEMBER_ROLE_LABELS[row.invite.role] })
      .onConflictDoUpdate({
        target: [startupMembers.startupId, startupMembers.userId],
        set: { role: row.invite.role, isAdmin: row.invite.makeAdmin, removedAt: null, joinedAt: new Date() },
      });
    await tx.update(startupInvites).set({ status: "accepted", invitedUserId: userId }).where(eq(startupInvites.id, row.invite.id));
    await tx.update(startups).set({ teamSize: sql`greatest(coalesce(${startups.teamSize}, 0), (select count(*) from ${startupMembers} where startup_id = ${row.invite.startupId} and removed_at is null))` }).where(eq(startups.id, row.invite.startupId));
  });
  await onTeamChanged(row.invite.startupId);
  if (row.invite.invitedById) {
    const [me] = await db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.userId, userId));
    await notify({
      userId: row.invite.invitedById,
      type: "startup_invite",
      title: `${me?.name ?? "Someone"} joined ${row.startup.name}`,
      href: `/startups/${row.startup.slug}/team`,
      actorId: userId,
    });
  }
  return { startup: row.startup, accepted: true };
}

export async function revokeInvite(actorId: string, inviteId: string) {
  const [inv] = await db.select().from(startupInvites).where(eq(startupInvites.id, inviteId));
  if (!inv) throw notFound("Invite");
  await assertCan(actorId, inv.startupId, "invite_members");
  await db.update(startupInvites).set({ status: "revoked" }).where(eq(startupInvites.id, inviteId));
}

async function remainingAdmins(startupId: string, excludingUserId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(startupMembers)
    .where(
      and(
        eq(startupMembers.startupId, startupId),
        isNull(startupMembers.removedAt),
        ne(startupMembers.userId, excludingUserId),
        sql`(${startupMembers.isAdmin} or ${startupMembers.role} = 'founder')`,
      ),
    );
  return row?.n ?? 0;
}

export async function removeMember(actorId: string, startupId: string, memberUserId: string) {
  if (actorId !== memberUserId) await assertCan(actorId, startupId, "remove_members");
  const target = await getMembership(memberUserId, startupId);
  if (!target) throw notFound("Team member");
  if ((target.isAdmin || target.role === "founder") && (await remainingAdmins(startupId, memberUserId)) === 0) {
    throw new AppError("VALIDATION", "A startup needs at least one admin. Make someone else an admin first.");
  }
  await db
    .update(startupMembers)
    .set({ removedAt: new Date() })
    .where(and(eq(startupMembers.startupId, startupId), eq(startupMembers.userId, memberUserId)));
  await audit({ actorId, action: actorId === memberUserId ? "startup.leave" : "startup.remove_member", targetType: "startup", targetId: startupId, metadata: { memberUserId } });
  await onTeamChanged(startupId);
}

export const memberUpdateSchema = z.object({
  role: z.enum(STARTUP_MEMBER_ROLES).optional(),
  title: text(80),
  isAdmin: z.boolean().optional(),
});

export async function updateMember(actorId: string, startupId: string, memberUserId: string, raw: z.input<typeof memberUpdateSchema>) {
  await assertCan(actorId, startupId, "manage_settings");
  const data = memberUpdateSchema.parse(raw);
  const target = await getMembership(memberUserId, startupId);
  if (!target) throw notFound("Team member");
  const losingAdmin = (data.isAdmin === false || (data.role && data.role !== "founder" && !target.isAdmin)) && (target.isAdmin || target.role === "founder");
  if (losingAdmin && (await remainingAdmins(startupId, memberUserId)) === 0) {
    throw new AppError("VALIDATION", "A startup needs at least one admin.");
  }
  await db
    .update(startupMembers)
    .set(data)
    .where(and(eq(startupMembers.startupId, startupId), eq(startupMembers.userId, memberUserId)));
  await audit({ actorId, action: "startup.update_member", targetType: "startup", targetId: startupId, metadata: { memberUserId, ...data } });
}

/** Keep derived state (team chat membership) in sync. Implemented by messaging/groups. */
async function onTeamChanged(startupId: string) {
  const groups = await import("../messaging/groups").catch(() => null);
  if (groups && "syncStartupGroupMembers" in groups) await groups.syncStartupGroupMembers(startupId);
}

// ── Needs ─────────────────────────────────────────────────────────────────────

export const needInputSchema = z.object({
  startupId: z.string().uuid().nullable().optional(),
  type: z.enum(NEED_TYPES),
  title: z.string().trim().min(2, "Describe the need in a few words.").max(120),
  description: text(1000),
  consultantCategoryId: z.string().uuid().nullable().optional(),
  commitment: z.enum(COMMITMENTS).nullable().optional(),
  budgetMaxCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  skillIds: z.array(z.string().uuid()).max(10).optional(),
});

export async function createNeed(userId: string, raw: z.input<typeof needInputSchema>) {
  const { skillIds, ...data } = needInputSchema.parse(raw);
  if (data.startupId) await assertCan(userId, data.startupId, "manage_needs");
  const [need] = await db.insert(needs).values({ ...data, ownerId: userId }).returning();
  if (skillIds?.length) {
    const valid = await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, skillIds));
    if (valid.length) await db.insert(needSkills).values(valid.map((s) => ({ needId: need!.id, skillId: s.id })));
  }
  track("need_created", userId, { type: data.type });
  return need!;
}

export async function setNeedStatus(userId: string, needId: string, status: "open" | "paused" | "fulfilled" | "closed") {
  const [n] = await db.select().from(needs).where(eq(needs.id, needId));
  if (!n) throw notFound("Need");
  if (n.startupId) await assertCan(userId, n.startupId, "manage_needs");
  else if (n.ownerId !== userId) throw forbidden();
  await db.update(needs).set({ status }).where(eq(needs.id, needId));
}

export async function deleteNeed(userId: string, needId: string) {
  const [n] = await db.select().from(needs).where(eq(needs.id, needId));
  if (!n) throw notFound("Need");
  if (n.startupId) await assertCan(userId, n.startupId, "manage_needs");
  else if (n.ownerId !== userId) throw forbidden();
  await db.delete(needs).where(eq(needs.id, needId));
}

async function hydrateNeeds(rows: (typeof needs.$inferSelect)[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [skillRows, categories] = await Promise.all([
    db
      .select({ needId: needSkills.needId, name: skills.name, id: skills.id })
      .from(needSkills)
      .innerJoin(skills, eq(skills.id, needSkills.skillId))
      .where(inArray(needSkills.needId, ids)),
    db.select().from(consultantCategories),
  ]);
  return rows.map((r) => ({
    ...r,
    skills: skillRows.filter((s) => s.needId === r.id),
    category: categories.find((c) => c.id === r.consultantCategoryId) ?? null,
  }));
}

export async function listNeedsForStartup(startupId: string, opts: { includeClosed?: boolean } = {}) {
  const rows = await db
    .select()
    .from(needs)
    .where(and(eq(needs.startupId, startupId), opts.includeClosed ? undefined : eq(needs.status, "open")))
    .orderBy(desc(needs.createdAt));
  return hydrateNeeds(rows);
}

/** Needs the user owns or that belong to startups they're on. */
export async function listNeedsForUser(userId: string, opts: { openOnly?: boolean } = {}) {
  const myStartups = db
    .select({ id: startupMembers.startupId })
    .from(startupMembers)
    .where(and(eq(startupMembers.userId, userId), isNull(startupMembers.removedAt)));
  const rows = await db
    .select()
    .from(needs)
    .where(and(sql`(${needs.ownerId} = ${userId} or ${needs.startupId} in ${myStartups})`, opts.openOnly ? eq(needs.status, "open") : undefined))
    .orderBy(desc(needs.createdAt))
    .limit(50);
  return hydrateNeeds(rows);
}

// ── Open roles ────────────────────────────────────────────────────────────────

export const openRoleSchema = z.object({
  title: z.string().trim().min(2).max(100),
  type: z.enum(["cofounder", "employee", "contractor", "advisor"]),
  description: text(1500),
  commitment: z.enum(COMMITMENTS).nullable().optional(),
  location: text(100),
  compensation: text(100),
  equity: text(100),
});

export async function createOpenRole(userId: string, startupId: string, raw: z.input<typeof openRoleSchema>) {
  await assertCan(userId, startupId, "manage_needs");
  const [row] = await db.insert(openRoles).values({ ...openRoleSchema.parse(raw), startupId }).returning();
  return row!;
}

export async function setOpenRoleOpen(userId: string, roleId: string, isOpen: boolean) {
  const [r] = await db.select().from(openRoles).where(eq(openRoles.id, roleId));
  if (!r) throw notFound("Role");
  await assertCan(userId, r.startupId, "manage_needs");
  await db.update(openRoles).set({ isOpen }).where(eq(openRoles.id, roleId));
}

export async function deleteOpenRole(userId: string, roleId: string) {
  const [r] = await db.select().from(openRoles).where(eq(openRoles.id, roleId));
  if (!r) throw notFound("Role");
  await assertCan(userId, r.startupId, "manage_needs");
  await db.delete(openRoles).where(eq(openRoles.id, roleId));
}

/** Pending invites addressed to this user (by id or email). */
export async function listMyInvites(userId: string, email: string) {
  return db
    .select({ invite: startupInvites, startup: startups })
    .from(startupInvites)
    .innerJoin(startups, eq(startups.id, startupInvites.startupId))
    .where(
      and(
        eq(startupInvites.status, "pending"),
        sql`${startupInvites.expiresAt} > now()`,
        sql`(${startupInvites.invitedUserId} = ${userId} or lower(${startupInvites.email}) = ${email.toLowerCase()})`,
      ),
    );
}
