import type { StartupMemberRole } from "@/lib/domain";

export type StartupMembership = { role: StartupMemberRole; isAdmin: boolean } | null;

export const STARTUP_ACTIONS = [
  "view_private",
  "edit",
  "invite_members",
  "remove_members",
  "manage_bookings",
  "manage_needs",
  "manage_settings",
  "join_team_chat",
] as const;
export type StartupAction = (typeof STARTUP_ACTIONS)[number];

/**
 * Startup permission policy. Founders are always admins; other members only get
 * management rights when explicitly made admin. Contractors can see the team space
 * but never manage it.
 */
export function canOnStartup(membership: StartupMembership, action: StartupAction): boolean {
  if (!membership) return false;
  const admin = membership.isAdmin || membership.role === "founder";
  switch (action) {
    case "view_private":
    case "join_team_chat":
      return true;
    case "manage_bookings":
      return admin || membership.role === "cofounder";
    case "manage_needs":
      return admin || membership.role === "cofounder";
    case "edit":
    case "invite_members":
    case "remove_members":
    case "manage_settings":
      return admin;
  }
}
