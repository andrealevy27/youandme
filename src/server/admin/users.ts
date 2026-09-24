import "server-only";
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  adminUsers,
  consultantProfiles,
  identityVerifications,
  profiles,
  reports,
  session,
  user,
  userRoles,
} from "../db/schema";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { notify } from "../notifications";
import { hasAdminPermission } from "../authz/admin";
import type { Viewer } from "../auth/session";
import { ACCOUNT_STATUSES, type AccountStatus, type AdminRole } from "@/lib/domain";
import { assertNotSelf } from "./guard";
import { ADMIN_PAGE_SIZE, likePattern, pageOffset, suspensionEnd } from "./utils";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  handle: string;
  roles: string[];
  adminRole: AdminRole | null;
  status: AccountStatus;
  featured: boolean;
  isDemo: boolean;
  joinedAt: Date;
};

const rolesAgg = sql<string[]>`coalesce((select array_agg(${userRoles.role} order by ${userRoles.role}) from ${userRoles} where ${userRoles.userId} = ${profiles.userId}), '{}')`;

export async function listUsers(opts: { q?: string; status?: AccountStatus | "all"; page: number }) {
  const filters: (SQL | undefined)[] = [];
  if (opts.q) {
    const p = likePattern(opts.q);
    filters.push(or(ilike(profiles.displayName, p), ilike(user.email, p), ilike(profiles.handle, p)));
  }
  if (opts.status && opts.status !== "all" && ACCOUNT_STATUSES.includes(opts.status)) filters.push(eq(profiles.status, opts.status));
  const where = and(...filters);

  const [rowsRes, totalRes] = await Promise.all([
    db
      .select({
        id: profiles.userId,
        name: profiles.displayName,
        email: user.email,
        handle: profiles.handle,
        roles: rolesAgg,
        adminRole: adminUsers.role,
        status: profiles.status,
        featured: profiles.featured,
        isDemo: profiles.isDemo,
        joinedAt: user.createdAt,
      })
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.userId))
      .leftJoin(adminUsers, eq(adminUsers.userId, profiles.userId))
      .where(where)
      .orderBy(desc(user.createdAt), desc(profiles.userId))
      .limit(ADMIN_PAGE_SIZE)
      .offset(pageOffset(opts.page)),
    db.select({ n: count() }).from(profiles).innerJoin(user, eq(user.id, profiles.userId)).where(where),
  ]);
  return { rows: rowsRes as AdminUserRow[], total: totalRes[0]?.n ?? 0 };
}

export async function getUserDetail(userId: string) {
  const [row] = await db
    .select({ profile: profiles, email: user.email, emailVerified: user.emailVerified, joinedAt: user.createdAt, roles: rolesAgg, adminRole: adminUsers.role })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.userId))
    .leftJoin(adminUsers, eq(adminUsers.userId, profiles.userId))
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!row) return null;

  const [verifications, reportsAgainst, sessions, consultant] = await Promise.all([
    db.select().from(identityVerifications).where(eq(identityVerifications.userId, userId)).orderBy(desc(identityVerifications.createdAt)),
    db
      .select({
        id: reports.id,
        targetType: reports.targetType,
        reason: reports.reason,
        details: reports.details,
        status: reports.status,
        createdAt: reports.createdAt,
        reporterName: profiles.displayName,
      })
      .from(reports)
      .leftJoin(profiles, eq(profiles.userId, reports.reporterId))
      .where(and(inArray(reports.targetType, ["user", "consultant"]), eq(reports.targetId, userId)))
      .orderBy(desc(reports.createdAt))
      .limit(50),
    db.select({ n: count() }).from(session).where(and(eq(session.userId, userId), sql`${session.expiresAt} > now()`)),
    db
      .select({ status: consultantProfiles.status, featured: consultantProfiles.featured, headline: consultantProfiles.headline })
      .from(consultantProfiles)
      .where(eq(consultantProfiles.userId, userId))
      .limit(1),
  ]);

  return {
    ...row,
    verifications,
    reportsAgainst,
    activeSessions: sessions[0]?.n ?? 0,
    consultant: consultant[0] ?? null,
  };
}

async function loadTarget(userId: string) {
  const [target] = await db
    .select({ userId: profiles.userId, status: profiles.status, displayName: profiles.displayName, adminRole: adminUsers.role })
    .from(profiles)
    .leftJoin(adminUsers, eq(adminUsers.userId, profiles.userId))
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!target) throw notFound("That user");
  if (target.status === "deleted") throw new AppError("CONFLICT", "This account has been deleted.");
  return target;
}

/** Only admins who can manage admins may moderate another admin account. */
function assertCanModerate(actor: Viewer, target: { adminRole: AdminRole | null }) {
  if (target.adminRole && !hasAdminPermission(actor.adminRole, "admins.manage")) {
    throw new AppError("FORBIDDEN", "Only admins who manage admin access can moderate another admin.");
  }
}

export async function revokeSessions(userId: string) {
  const deleted = await db.delete(session).where(eq(session.userId, userId)).returning({ id: session.id });
  return deleted.length;
}

export async function suspendUser(actor: Viewer, input: { userId: string; days: number | null; reason: string }) {
  assertNotSelf(actor.userId, input.userId, "a suspension");
  const target = await loadTarget(input.userId);
  assertCanModerate(actor, target);
  const until = suspensionEnd(input.days);
  await db.update(profiles).set({ status: "suspended", suspendedUntil: until }).where(eq(profiles.userId, input.userId));
  const revoked = await revokeSessions(input.userId);
  await audit({
    actorId: actor.userId,
    action: "user.suspended",
    targetType: "user",
    targetId: input.userId,
    metadata: { reason: input.reason, until: until?.toISOString() ?? null, previousStatus: target.status, sessionsRevoked: revoked },
  });
  await notify({
    userId: input.userId,
    type: "system",
    title: "Your You&Me account has been suspended",
    body: `${until ? `Your account is suspended until ${until.toUTCString()}.` : "Your account is suspended until further notice."} Reason: ${input.reason}`,
    actorId: actor.userId,
  });
}

export async function unsuspendUser(actor: Viewer, userId: string) {
  const target = await loadTarget(userId);
  assertCanModerate(actor, target);
  if (target.status !== "suspended") throw new AppError("CONFLICT", "This account isn't suspended.");
  await db.update(profiles).set({ status: "active", suspendedUntil: null }).where(eq(profiles.userId, userId));
  await audit({ actorId: actor.userId, action: "user.unsuspended", targetType: "user", targetId: userId });
  await notify({
    userId,
    type: "system",
    title: "Your You&Me account is active again",
    body: "Your suspension has been lifted. Welcome back.",
    href: "/home",
    actorId: actor.userId,
  });
}

export async function banUser(actor: Viewer, input: { userId: string; reason: string }) {
  assertNotSelf(actor.userId, input.userId, "a ban");
  const target = await loadTarget(input.userId);
  assertCanModerate(actor, target);
  await db.update(profiles).set({ status: "banned", suspendedUntil: null, featured: false }).where(eq(profiles.userId, input.userId));
  const revoked = await revokeSessions(input.userId);
  await audit({
    actorId: actor.userId,
    action: "user.banned",
    targetType: "user",
    targetId: input.userId,
    metadata: { reason: input.reason, previousStatus: target.status, sessionsRevoked: revoked },
  });
  await notify({
    userId: input.userId,
    type: "system",
    title: "Your You&Me account has been closed",
    body: `Your account was banned for violating our community guidelines. Reason: ${input.reason}`,
    actorId: actor.userId,
  });
}

export async function unbanUser(actor: Viewer, userId: string) {
  const target = await loadTarget(userId);
  if (target.status !== "banned") throw new AppError("CONFLICT", "This account isn't banned.");
  await db.update(profiles).set({ status: "active" }).where(eq(profiles.userId, userId));
  await audit({ actorId: actor.userId, action: "user.unbanned", targetType: "user", targetId: userId });
}

export async function setUserFeatured(actor: Viewer, input: { userId: string; featured: boolean }) {
  await loadTarget(input.userId);
  await db.update(profiles).set({ featured: input.featured }).where(eq(profiles.userId, input.userId));
  await audit({ actorId: actor.userId, action: input.featured ? "user.featured" : "user.unfeatured", targetType: "user", targetId: input.userId });
}

export async function setAdminRole(actor: Viewer, input: { userId: string; role: AdminRole | null }) {
  assertNotSelf(actor.userId, input.userId, "an admin role change");
  const target = await loadTarget(input.userId);
  const previous = target.adminRole;
  if (previous === input.role) return;

  if (previous === "super_admin" && input.role !== "super_admin") {
    const [row] = await db.select({ n: count() }).from(adminUsers).where(eq(adminUsers.role, "super_admin"));
    if ((row?.n ?? 0) <= 1) throw new AppError("CONFLICT", "You&Me needs at least one super admin.");
  }

  if (input.role === null) {
    await db.delete(adminUsers).where(eq(adminUsers.userId, input.userId));
  } else {
    await db
      .insert(adminUsers)
      .values({ userId: input.userId, role: input.role, grantedById: actor.userId })
      .onConflictDoUpdate({ target: adminUsers.userId, set: { role: input.role, grantedById: actor.userId } });
  }
  await audit({
    actorId: actor.userId,
    action: input.role ? "admin.role_granted" : "admin.role_revoked",
    targetType: "user",
    targetId: input.userId,
    metadata: { previousRole: previous, role: input.role },
  });
}
