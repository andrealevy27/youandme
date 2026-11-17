import { vi, beforeEach, describe, expect, it } from "vitest";

// Student mode is read from the environment at import time, so turn it on before any app module loads.
vi.hoisted(() => {
  process.env.STUDENT_MODE = "true";
});

import { db } from "@/server/db";
import * as s from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createUser, resetDatabase } from "../support/db";
import { assertStudentSignupAllowed, canSeeStudents, markSchoolVerified, updateStudentPrefs } from "@/server/student";
import { searchPeople } from "@/server/search";
import { canViewProfile } from "@/server/privacy/visibility";
import { saveStudentStep, finishStudentOnboarding, toMatchingFields } from "@/server/student/onboarding";
import { SHORT_QUIZ_KEYS } from "@/lib/student";

beforeEach(async () => {
  await resetDatabase();
});

async function student(email: string, opts: { verified?: boolean; scope?: "all" | "my_school"; visible?: boolean } = {}) {
  const u = await createUser({ email, profile: { lookingForCofounder: true, visibility: opts.visible === false ? "hidden" : "public" } });
  if (opts.verified !== false) await markSchoolVerified(u.id, email);
  if (opts.scope) await updateStudentPrefs(u.id, { campusScope: opts.scope });
  return u;
}

const ids = (page: { items: { person: { userId: string } }[] }) => page.items.map((p) => p.person.userId).sort();

describe("student mode", () => {
  it("only accepts school emails at sign-up", () => {
    expect(() => assertStudentSignupAllowed("a@nyu.edu")).not.toThrow();
    expect(() => assertStudentSignupAllowed("a@cs.stanford.edu")).not.toThrow();
    expect(() => assertStudentSignupAllowed("a@gmail.com")).toThrow(/school email/);
  });

  it("records the school from the confirmed email", async () => {
    const u = await student("maya@nyu.edu");
    const [p] = await db.select().from(s.profiles).where(eq(s.profiles.userId, u.id));
    expect(p?.school).toBe("nyu");
    expect(p?.schoolVerifiedAt).not.toBeNull();
    expect(p?.university).toBe("New York University");
  });

  it("hides unverified, hidden and out-of-scope students", async () => {
    const viewer = await student("viewer@nyu.edu");
    const nyu = await student("nyu1@nyu.edu");
    const stanford = await student("s1@stanford.edu");
    await student("unverified@nyu.edu", { verified: false });
    await student("hidden@nyu.edu", { visible: false });
    const stanfordOnly = await student("s2@stanford.edu", { scope: "my_school" });

    const page = await searchPeople(viewer.id, { q: "" });
    expect(ids(page)).toEqual([nyu.id, stanford.id].sort());
    expect(await canViewProfile(viewer.id, stanfordOnly.id)).toBe(false);
    expect(await canViewProfile(viewer.id, stanford.id)).toBe(true);

    const mine = await searchPeople(viewer.id, { q: "", filters: { school: "mine" } });
    expect(ids(mine)).toEqual([nyu.id]);
  });

  it("'my school only' applies to the viewer too", async () => {
    const viewer = await student("viewer@nyu.edu", { scope: "my_school" });
    const nyu = await student("nyu1@nyu.edu");
    await student("s1@stanford.edu");
    expect(ids(await searchPeople(viewer.id, { q: "" }))).toEqual([nyu.id]);
  });

  it("unverified students can't see anyone", async () => {
    const viewer = await student("viewer@nyu.edu", { verified: false });
    const other = await student("other@nyu.edu");
    expect(await canSeeStudents({ userId: viewer.id, adminRole: null })).toBe(false);
    expect(await canViewProfile(viewer.id, other.id)).toBe(false);
  });
});

describe("student onboarding", () => {
  it("maps hours and summer plans onto the matching fields", () => {
    expect(toMatchingFields(3, "undecided")).toEqual({ availability: "limited", commitment: "exploring" });
    expect(toMatchingFields(8, "build")).toEqual({ availability: "nights_weekends", commitment: "full_time_soon" });
    expect(toMatchingFields(25, "internship")).toEqual({ availability: "part_time", commitment: "part_time" });
  });

  it("saves each step, scores the short quiz and respects the visibility choice", async () => {
    const u = await student("new@nyu.edu");
    await saveStudentStep(u.id, { step: "about", index: 0, data: { displayName: "Ana", classYear: "junior", major: "Economics" } });
    await saveStudentStep(u.id, { step: "idea", index: 2, data: { ideaStatus: "join_one" } });
    await saveStudentStep(u.id, { step: "time", index: 4, data: { weeklyHours: 15, summerPlans: "build" } });
    await saveStudentStep(u.id, { step: "quiz", index: 5, answers: Object.fromEntries(SHORT_QUIZ_KEYS.map((k) => [k, 5])) });
    await finishStudentOnboarding(u.id, { visible: false, campusScope: "my_school" });
    const [p] = await db.select().from(s.profiles).where(eq(s.profiles.userId, u.id));
    expect(p).toMatchObject({ headline: "Economics · Junior", ideaStatus: "join_one", lookingForCofounder: true, weeklyHours: 15, commitment: "full_time_soon", visibility: "hidden", campusScope: "my_school" });
    const [style] = await db.select().from(s.personalityProfiles).where(eq(s.personalityProfiles.userId, u.id));
    expect(Object.keys(style!.scores as object)).toHaveLength(7);
  });

  it("rejects an incomplete short quiz", async () => {
    const u = await student("q@nyu.edu");
    await expect(saveStudentStep(u.id, { step: "quiz", index: 5, answers: { vision_story: 3 } })).rejects.toThrow(/seven/);
  });
});
