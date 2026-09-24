import type { AdminPermission } from "../authz/admin";
import { hasAdminPermission } from "../authz/admin";
import type { AdminRole } from "../../lib/domain";

export type AdminNavEntry = { href: string; label: string; permission: AdminPermission };

/** Admin sections in display order. A section is shown only when the admin holds its permission. */
export const ADMIN_NAV: readonly AdminNavEntry[] = [
  { href: "/admin", label: "Overview", permission: "analytics.read" },
  { href: "/admin/users", label: "Users", permission: "users.read" },
  { href: "/admin/consultants", label: "Consultants", permission: "consultants.review" },
  { href: "/admin/startups", label: "Startups", permission: "startups.moderate" },
  { href: "/admin/reports", label: "Reports", permission: "reports.handle" },
  { href: "/admin/bookings", label: "Bookings", permission: "bookings.read" },
  { href: "/admin/categories", label: "Categories", permission: "categories.manage" },
  { href: "/admin/reviews", label: "Reviews", permission: "reviews.moderate" },
  { href: "/admin/verification", label: "Verification", permission: "verification.review" },
  { href: "/admin/growth", label: "Growth", permission: "invites.manage" },
  { href: "/admin/settings", label: "Settings", permission: "settings.manage" },
  { href: "/admin/notifications", label: "Broadcast", permission: "notifications.broadcast" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.read" },
];

export function visibleAdminNav(role: AdminRole | null | undefined): AdminNavEntry[] {
  return ADMIN_NAV.filter((item) => hasAdminPermission(role, item.permission));
}
