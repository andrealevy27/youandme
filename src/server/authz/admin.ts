import type { AdminRole } from "@/lib/domain";

export const ADMIN_PERMISSIONS = [
  "users.read",
  "users.moderate",
  "consultants.review",
  "startups.moderate",
  "reports.handle",
  "bookings.read",
  "payments.read",
  "payments.refund",
  "categories.manage",
  "reviews.moderate",
  "verification.review",
  "waitlist.manage",
  "invites.manage",
  "featured.manage",
  "notifications.broadcast",
  "analytics.read",
  "settings.manage",
  "admins.manage",
  "audit.read",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ALL = new Set<AdminPermission>(ADMIN_PERMISSIONS);

export const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  super_admin: ALL,
  moderator: new Set([
    "users.read",
    "users.moderate",
    "startups.moderate",
    "reports.handle",
    "reviews.moderate",
    "verification.review",
    "consultants.review",
    "audit.read",
  ]),
  support: new Set(["users.read", "bookings.read", "reports.handle", "waitlist.manage", "invites.manage", "verification.review"]),
  finance: new Set(["bookings.read", "payments.read", "payments.refund", "analytics.read"]),
  ops: new Set([
    "users.read",
    "categories.manage",
    "featured.manage",
    "waitlist.manage",
    "invites.manage",
    "notifications.broadcast",
    "analytics.read",
    "consultants.review",
  ]),
};

export function hasAdminPermission(role: AdminRole | null | undefined, permission: AdminPermission): boolean {
  return !!role && ROLE_PERMISSIONS[role].has(permission);
}
