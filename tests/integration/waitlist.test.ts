import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as s from "@/server/db/schema";
import { joinWaitlist } from "@/server/waitlist";
import { exportWaitlist, inviteNextFromWaitlist } from "@/server/admin/growth";
import { loadViewer } from "@/server/auth/session";
import { createUser, resetDatabase } from "../support/db";

const sent = vi.hoisted(() => [] as { to: string; subject: string }[]);
vi.mock("@/server/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/email")>()),
  sendEmail: async (msg: { to: string; subject: string }) => void sent.push(msg),
}));

beforeEach(async () => {
  await resetDatabase();
  sent.length = 0;
});

async function adminViewer() {
  const u = await createUser({ name: "Ops Admin" });
  await db.insert(s.adminUsers).values({ userId: u.id, role: "super_admin" });
  return (await loadViewer(u.id, u.email, true, u.name))!;
}

describe("waitlist", () => {
  it("adds people once, normalising email, and confirms only the first time", async () => {
    expect(await joinWaitlist({ email: "Ada@Example.com ", name: "Ada Lovelace", intent: "building" })).toEqual({ created: true });
    expect(await joinWaitlist({ email: "ada@example.com", name: "Someone Else", intent: "exploring" })).toEqual({ created: false });

    const rows = await db.select().from(s.waitlistEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "ada@example.com", name: "Ada Lovelace", status: "waiting" });
    expect(sent).toEqual([expect.objectContaining({ to: "ada@example.com", subject: "You're on the You&Me waitlist" })]);
  });

  it("invites the longest-waiting people first and skips anyone already invited", async () => {
    for (const [i, name] of ["First", "Second", "Third"].entries()) {
      await db.insert(s.waitlistEntries).values({ email: `${name.toLowerCase()}@example.com`, name, createdAt: new Date(Date.UTC(2026, 0, i + 1)) });
    }
    const admin = await adminViewer();

    expect(await inviteNextFromWaitlist(admin, 2)).toEqual({ invited: 2 });
    const byEmail = Object.fromEntries((await db.select().from(s.waitlistEntries)).map((r) => [r.email, r]));
    expect(byEmail["first@example.com"]?.status).toBe("invited");
    expect(byEmail["second@example.com"]?.status).toBe("invited");
    expect(byEmail["third@example.com"]?.status).toBe("waiting");
    expect(sent.map((m) => m.to)).toEqual(["first@example.com", "second@example.com"]);

    const [invite] = await db.select().from(s.platformInvites).where(eq(s.platformInvites.id, byEmail["first@example.com"]!.inviteId!));
    expect(invite).toMatchObject({ email: "first@example.com", maxUses: 1 });

    expect(await inviteNextFromWaitlist(admin, 10)).toEqual({ invited: 1 });
    await expect(inviteNextFromWaitlist(admin, 10)).rejects.toThrow(/No one is waiting/);
  });

  it("marks entries joined when they sign up and exports every entry", async () => {
    await joinWaitlist({ email: "grace@example.com", name: "Grace Hopper", intent: "cofounder", note: "=cmd" });
    await joinWaitlist({ email: "linus@example.com", name: "Linus", intent: "join" });
    await createUser({ email: "grace@example.com" });

    const rows = await exportWaitlist();
    expect(rows.map((r) => [r.email, r.status])).toEqual([
      ["grace@example.com", "joined"],
      ["linus@example.com", "waiting"],
    ]);
  });
});
