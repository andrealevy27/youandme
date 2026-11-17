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
