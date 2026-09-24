import { describe, expect, it } from "vitest";
import { canOnStartup, STARTUP_ACTIONS } from "@/server/authz/startup";
import { ADMIN_PERMISSIONS, hasAdminPermission } from "@/server/authz/admin";

describe("startup permissions", () => {
  it("denies everything to non-members", () => {
    for (const a of STARTUP_ACTIONS) expect(canOnStartup(null, a)).toBe(false);
  });

  it("gives founders full control", () => {
    for (const a of STARTUP_ACTIONS) expect(canOnStartup({ role: "founder", isAdmin: false }, a)).toBe(true);
  });

  it("lets cofounders manage bookings and needs but not settings unless admin", () => {
    const m = { role: "cofounder" as const, isAdmin: false };
    expect(canOnStartup(m, "manage_bookings")).toBe(true);
    expect(canOnStartup(m, "manage_needs")).toBe(true);
    expect(canOnStartup(m, "edit")).toBe(false);
    expect(canOnStartup(m, "remove_members")).toBe(false);
    expect(canOnStartup({ ...m, isAdmin: true }, "edit")).toBe(true);
  });

  it("keeps contractors and advisors read-only", () => {
    for (const role of ["contractor", "advisor", "employee"] as const) {
      const m = { role, isAdmin: false };
      expect(canOnStartup(m, "view_private")).toBe(true);
      expect(canOnStartup(m, "join_team_chat")).toBe(true);
      expect(canOnStartup(m, "manage_bookings")).toBe(false);
      expect(canOnStartup(m, "invite_members")).toBe(false);
    }
  });
});

describe("admin permissions", () => {
  it("grants super admins everything and nobody anything without a role", () => {
    for (const p of ADMIN_PERMISSIONS) {
      expect(hasAdminPermission("super_admin", p)).toBe(true);
      expect(hasAdminPermission(null, p)).toBe(false);
    }
  });

  it("scopes other roles", () => {
    expect(hasAdminPermission("moderator", "reports.handle")).toBe(true);
    expect(hasAdminPermission("moderator", "payments.refund")).toBe(false);
    expect(hasAdminPermission("finance", "payments.refund")).toBe(true);
    expect(hasAdminPermission("finance", "users.moderate")).toBe(false);
    expect(hasAdminPermission("support", "admins.manage")).toBe(false);
  });
});
