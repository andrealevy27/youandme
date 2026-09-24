import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as s from "@/server/db/schema";
import { createUser, resetDatabase } from "../support/db";
import { loadViewer } from "@/server/auth/session";
import { assertSignupAllowed } from "@/server/auth/lifecycle";
import { setSetting } from "@/server/settings";
import { completeOnboarding, setUserSkills, updateProfile } from "@/server/people/profile";
import { getFullProfile, getProfileCompletion } from "@/server/people";
import {
  createStartup,
  getStartupBySlug,
  inviteMember,
  removeMember,
  respondToInvite,
  updateMember,
  updateStartup,
} from "@/server/startups";
import { getDailyRecommendations } from "@/server/recommendations";
import { expressInterest, passOn } from "@/server/matching/interests";
import { sendMessage, listMessages, listInbox } from "@/server/messaging";
import { deleteAccount, exportMyData } from "@/server/privacy/account";
import { submitQuiz } from "@/server/personality";
import { canViewProfile } from "@/server/privacy/visibility";

beforeEach(async () => {
  await resetDatabase();
});

const founderProfile = {
  lookingForCofounder: true,
  cofounderTypes: ["technical"],
  commitment: "full_time" as const,
  availability: "full_time" as const,
  ambition: "venture_scale" as const,
};

describe("authentication lifecycle", () => {
  it("creates a profile, default collection and handle for new users", async () => {
    const u = await createUser({ name: "Ada Lovelace" });
    const [profile] = await db.select().from(s.profiles).where(eq(s.profiles.userId, u.id));
    expect(profile?.handle).toBe("ada-lovelace");
    const collections = await db.select().from(s.savedCollections).where(eq(s.savedCollections.userId, u.id));
    expect(collections).toHaveLength(1);
  });

  it("refuses viewers for suspended, banned and deleted accounts", async () => {
    const u = await createUser();
    expect(await loadViewer(u.id, u.email, true, u.name)).not.toBeNull();
    for (const status of ["banned", "deleted"] as const) {
      await db.update(s.profiles).set({ status }).where(eq(s.profiles.userId, u.id));
      expect(await loadViewer(u.id, u.email, true, u.name)).toBeNull();
    }
    await db.update(s.profiles).set({ status: "suspended", suspendedUntil: new Date(Date.now() + 86_400_000) }).where(eq(s.profiles.userId, u.id));
    expect(await loadViewer(u.id, u.email, true, u.name)).toBeNull();
  });

  it("enforces invite-only signups", async () => {
    await expect(assertSignupAllowed(undefined)).resolves.toBeUndefined();
    await setSetting("invite_only", true, null);
    await expect(assertSignupAllowed(undefined)).rejects.toThrow(/invite-only/);
    await db.insert(s.platformInvites).values({ code: "FOUNDERS1", maxUses: 1 });
    await expect(assertSignupAllowed("founders1")).resolves.toBeUndefined();
    await db.update(s.platformInvites).set({ uses: 1 }).where(eq(s.platformInvites.code, "FOUNDERS1"));
    await expect(assertSignupAllowed("FOUNDERS1")).rejects.toThrow();
  });
});

describe("profiles", () => {
  it("updates profile fields, derives roles from intents and validates links", async () => {
    const u = await createUser({ profile: { onboardingCompletedAt: null } });
    await updateProfile(u.id, { intents: ["building", "cofounder"], city: "Austin", country: "USA", linkedinUrl: "linkedin.com/in/ada" });
    const roles = await db.select().from(s.userRoles).where(eq(s.userRoles.userId, u.id));
    expect(roles.map((r) => r.role).sort()).toEqual(["cofounder_candidate", "founder"]);
    const full = await getFullProfile(u.id, u.id);
    expect(full?.profile.location).toBe("Austin, USA");
    expect(full?.profile.linkedinUrl).toBe("https://linkedin.com/in/ada");
    await expect(updateProfile(u.id, { websiteUrl: "javascript:alert(1)" })).rejects.toThrow();
    await completeOnboarding(u.id);
    const [p] = await db.select().from(s.profiles).where(eq(s.profiles.userId, u.id));
    expect(p?.onboardingCompletedAt).not.toBeNull();
  });

  it("reports honest completion", async () => {
    const u = await createUser();
    const before = await getProfileCompletion(u.id);
    const skills = await db.select().from(s.skills).limit(3);
    await setUserSkills(u.id, skills.map((k) => k.id));
    await updateProfile(u.id, { headline: "Engineer", linkedinUrl: "https://linkedin.com/in/x" });
    const after = await getProfileCompletion(u.id);
    expect(after.percent).toBeGreaterThan(before.percent);
    expect(after.missing.map((m) => m.key)).not.toContain("skills");
  });

  it("stores quiz answers and requires a complete quiz", async () => {
    const u = await createUser();
    const questions = await db.select().from(s.personalityQuestions);
    await expect(submitQuiz(u.id, { [questions[0]!.id]: 5 })).rejects.toThrow(/Answer all/);
    const scores = await submitQuiz(u.id, Object.fromEntries(questions.map((q) => [q.id, 4])));
    expect(Object.keys(scores)).toHaveLength(7);
  });

  it("hides profiles according to visibility and blocks", async () => {
    const a = await createUser();
    const b = await createUser();
    expect(await canViewProfile(a.id, b.id)).toBe(true);
    await db.update(s.profiles).set({ visibility: "members" }).where(eq(s.profiles.userId, b.id));
    expect(await canViewProfile(a.id, b.id)).toBe(false);
    await db.update(s.profiles).set({ visibility: "public" }).where(eq(s.profiles.userId, b.id));
    await db.insert(s.blocks).values({ blockerId: b.id, blockedId: a.id });
    expect(await canViewProfile(a.id, b.id)).toBe(false);
  });
});

describe("startups & permissions", () => {
  it("creates a startup with the creator as founder admin", async () => {
    const f = await createUser();
    const st = await createStartup(f.id, { name: "Kinwell", stage: "validation", tagline: "Care for families" });
    const data = await getStartupBySlug(f.id, st.slug);
    expect(data?.membership).toEqual({ role: "founder", isAdmin: true });
    expect(data?.members).toHaveLength(1);
  });

  it("runs the invite flow and enforces role permissions", async () => {
    const f = await createUser();
    const c = await createUser();
    const outsider = await createUser();
    const st = await createStartup(f.id, { name: "Gridwise", stage: "prototype" });

    await expect(inviteMember(outsider.id, st.id, { email: c.email, role: "cofounder" })).rejects.toThrow(/access/);
    const invite = await inviteMember(f.id, st.id, { email: c.email, role: "contractor" });
    const notifs = await db.select().from(s.notifications).where(eq(s.notifications.userId, c.id));
    expect(notifs.some((n) => n.type === "startup_invite")).toBe(true);

    await expect(respondToInvite(outsider.id, outsider.email, invite.token, true)).rejects.toThrow(/different account/);
    await respondToInvite(c.id, c.email, invite.token, true);

    // Contractors can't edit or invite.
    await expect(updateStartup(c.id, st.id, { tagline: "hacked" })).rejects.toThrow();
    await expect(inviteMember(c.id, st.id, { email: "x@y.com", role: "employee" })).rejects.toThrow();

    // Promote to admin → can edit.
    await updateMember(f.id, st.id, c.id, { isAdmin: true });
    await updateStartup(c.id, st.id, { tagline: "Cleaner charging" });

    // The last admin cannot be removed.
    await updateMember(f.id, st.id, c.id, { isAdmin: false });
    await expect(removeMember(f.id, st.id, f.id)).rejects.toThrow(/at least one admin/);
    await removeMember(f.id, st.id, c.id);
    const data = await getStartupBySlug(f.id, st.slug);
    expect(data?.members.map((m) => m.userId)).toEqual([f.id]);
  });

  it("hides team-only startups from non-members", async () => {
    const f = await createUser();
    const other = await createUser();
    const st = await createStartup(f.id, { name: "Stealth Co", stage: "idea", visibility: "hidden" });
    expect(await getStartupBySlug(other.id, st.slug)).toBeNull();
    expect(await getStartupBySlug(f.id, st.slug)).not.toBeNull();
  });
});

describe("matching & recommendations", () => {
  it("recommends at most five eligible people, stable for the day, excluding blocked/hidden/self", async () => {
    const viewer = await createUser({ profile: founderProfile, skills: ["go-to-market"], industries: ["Health"] });
    const candidates = [];
    for (let i = 0; i < 8; i++) {
      candidates.push(
        await createUser({
          profile: { ...founderProfile, cofounderTypes: ["business"] },
          skills: i % 2 ? ["backend", "machine-learning"] : ["product-design"],
          industries: ["Health"],
        }),
      );
    }
    const hidden = await createUser({ profile: { ...founderProfile, visibility: "hidden" }, skills: ["backend"] });
    const blocked = await createUser({ profile: founderProfile, skills: ["backend"] });
    const notSeeking = await createUser({ profile: { lookingForCofounder: false }, skills: ["backend"] });
    await db.insert(s.blocks).values({ blockerId: blocked.id, blockedId: viewer.id });

    const first = await getDailyRecommendations(viewer.id);
    expect(first.items).toHaveLength(5);
    const ids = first.items.map((i) => i.person.userId);
    for (const excluded of [viewer.id, hidden.id, blocked.id, notSeeking.id]) expect(ids).not.toContain(excluded);
    // Engineers (complementary to a business founder seeking technical) rank first.
    expect(first.items[0]!.person.skills).toContain("Backend engineering");
    expect(first.items[0]!.explanation.length).toBeGreaterThan(10);

    const again = await getDailyRecommendations(viewer.id);
    expect(again.items.map((i) => i.person.userId)).toEqual(ids);
  });

  it("creates a match, conversation and notifications on mutual interest; passes are respected", async () => {
    const a = await createUser({ profile: founderProfile, skills: ["go-to-market"] });
    const b = await createUser({ profile: { ...founderProfile, cofounderTypes: ["business"] }, skills: ["backend"] });
    const c = await createUser({ profile: founderProfile, skills: ["backend"] });

    expect((await expressInterest(a.id, b.id)).matched).toBe(false);
    const res = await expressInterest(b.id, a.id);
    expect(res.matched).toBe(true);
    if (!res.matched || !res.conversationId) throw new Error("expected a match with a conversation");
    const members = await db.select().from(s.conversationMembers).where(eq(s.conversationMembers.conversationId, res.conversationId));
    expect(members.map((m) => m.userId).sort()).toEqual([a.id, b.id].sort());
    for (const u of [a, b]) {
      const n = await db.select().from(s.notifications).where(and(eq(s.notifications.userId, u.id), eq(s.notifications.type, "new_match")));
      expect(n).toHaveLength(1);
    }

    await passOn(a.id, c.id);
    const recs = await getDailyRecommendations(a.id);
    expect(recs.items.map((i) => i.person.userId)).not.toContain(c.id);
    expect(recs.items.map((i) => i.person.userId)).not.toContain(b.id);
  });
});

describe("messaging authorization", () => {
  it("only lets conversation members read and write", async () => {
    const a = await createUser({ profile: founderProfile, skills: ["go-to-market"] });
    const b = await createUser({ profile: founderProfile, skills: ["backend"] });
    const outsider = await createUser();
    await expressInterest(a.id, b.id);
    const m = await expressInterest(b.id, a.id);
    if (!m.matched || !m.conversationId) throw new Error("no match");

    await sendMessage(a.id, { conversationId: m.conversationId, body: "Hi Sarah!" });
    const msgs = await listMessages(m.conversationId, b.id);
    expect(msgs.map((x) => x.body)).toContain("Hi Sarah!");
    const inbox = await listInbox(b.id);
    expect(inbox[0]?.unread).toBeGreaterThan(0);

    await expect(listMessages(m.conversationId, outsider.id)).rejects.toThrow(/not part of this conversation/);
    await expect(sendMessage(outsider.id, { conversationId: m.conversationId, body: "hello" })).rejects.toThrow();
  });
});

describe("account deletion & export", () => {
  it("exports the user's data", async () => {
    const u = await createUser({ skills: ["backend"] });
    const data = await exportMyData(u.id);
    expect(data.account?.email).toBe(u.email);
    expect(data.skills).toHaveLength(1);
  });

  it("anonymises the profile, removes sign-in methods and keeps others' messages", async () => {
    const a = await createUser({ profile: founderProfile, skills: ["go-to-market"], password: "correct horse battery" });
    const b = await createUser({ profile: founderProfile, skills: ["backend"] });
    await expressInterest(a.id, b.id);
    const m = await expressInterest(b.id, a.id);
    if (!m.matched || !m.conversationId) throw new Error("no match");
    await sendMessage(a.id, { conversationId: m.conversationId, body: "Before I go" });

    await expect(deleteAccount(a.id, { confirmation: "nope" })).rejects.toThrow(/DELETE/);
    await deleteAccount(a.id, { confirmation: "DELETE" });

    const [p] = await db.select().from(s.profiles).where(eq(s.profiles.userId, a.id));
    expect(p).toMatchObject({ status: "deleted", displayName: "Deleted member", bio: null, visibility: "hidden" });
    const [u] = await db.select().from(s.user).where(eq(s.user.id, a.id));
    expect(u?.email).not.toBe(a.email);
    expect(await db.select().from(s.account).where(eq(s.account.userId, a.id))).toHaveLength(0);
    expect(await db.select().from(s.userSkills).where(eq(s.userSkills.userId, a.id))).toHaveLength(0);
    expect(await loadViewer(a.id, a.email, true, a.name)).toBeNull();
    // The other participant still sees the message history.
    const msgs = await listMessages(m.conversationId, b.id);
    expect(msgs.some((x) => x.body === "Before I go")).toBe(true);
    const audit = await db.select().from(s.auditLogs).where(eq(s.auditLogs.action, "account.delete"));
    expect(audit).toHaveLength(1);
  });
});
