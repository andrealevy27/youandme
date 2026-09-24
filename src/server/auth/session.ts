import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { auth } from ".";
import { db } from "../db";
import { adminUsers, profiles, userRoles } from "../db/schema";
import { forbidden, unauthenticated } from "../errors";
import { hasAdminPermission, type AdminPermission } from "../authz/admin";
import type { AccountStatus, AdminRole } from "@/lib/domain";

export type Viewer = {
  userId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  status: AccountStatus;
  onboarded: boolean;
  roles: string[];
  adminRole: AdminRole | null;
};

export async function loadViewer(userId: string, email: string, emailVerified: boolean, name: string): Promise<Viewer | null> {
  const [row] = await db
    .select({
      profile: profiles,
      adminRole: adminUsers.role,
      roles: sql<string[]>`coalesce((select array_agg(${userRoles.role}) from ${userRoles} where ${userRoles.userId} = ${profiles.userId}), '{}')`,
    })
    .from(profiles)
    .leftJoin(adminUsers, eq(adminUsers.userId, profiles.userId))
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!row) return null;
  const p = row.profile;
  if (p.status === "banned" || p.status === "deleted") return null;
  if (p.status === "suspended" && (!p.suspendedUntil || p.suspendedUntil > new Date())) return null;
  return {
    userId,
    email,
    emailVerified,
    name,
    handle: p.handle,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    timezone: p.timezone,
    status: p.status,
    onboarded: !!p.onboardingCompletedAt,
    roles: row.roles ?? [],
    adminRole: row.adminRole ?? null,
  };
}

/** Resolve the signed-in viewer from request headers (works for route handlers and RSC). */
export async function getViewerFromHeaders(h: Headers): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  return loadViewer(session.user.id, session.user.email, session.user.emailVerified, session.user.name);
}

export const getViewer = cache(async (): Promise<Viewer | null> => getViewerFromHeaders(await headers()));

/** For pages: redirect instead of throwing. */
export async function requireViewerPage(opts: { onboarded?: boolean } = { onboarded: true }): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (opts.onboarded !== false && !viewer.onboarded) redirect("/onboarding");
  return viewer;
}

/** For server actions / API routes: throw typed errors. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw unauthenticated();
  return viewer;
}

export async function requireAdmin(permission: AdminPermission): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!hasAdminPermission(viewer.adminRole, permission)) throw forbidden();
  return viewer;
}

export async function requireAdminPage(permission: AdminPermission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!hasAdminPermission(viewer.adminRole, permission)) redirect("/home");
  return viewer;
}
