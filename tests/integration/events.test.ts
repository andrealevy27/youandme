import { vi, beforeEach, describe, expect, it } from "vitest";

vi.hoisted(() => {
  process.env.STUDENT_MODE = "true";
});

import { createUser, resetDatabase } from "../support/db";
import { markSchoolVerified } from "@/server/student";
import { createEvent, getEventIntroductions, getEventStats, joinEvent, setEventStatus, INTROS_PER_EVENT } from "@/server/events";
import { expressInterest } from "@/server/matching/interests";

beforeEach(async () => {
  await resetDatabase();
});

async function student(email: string, opts: { verified?: boolean; visible?: boolean } = {}) {
  const u = await createUser({ email, profile: { lookingForCofounder: true, visibility: opts.visible === false ? "hidden" : "public" } });
  if (opts.verified !== false) await markSchoolVerified(u.id, email);
  return { ...u, userId: u.id, adminRole: null };
}

const event = (school?: string) => createEvent((globalThis as { adminId?: string }).adminId ?? "", { name: "Team Hunt", startsAt: new Date().toISOString(), school });

describe("events", () => {
  it("introduces attendees to up to five other visible, verified attendees, and keeps the list stable", async () => {
    const admin = await createUser();
    (globalThis as { adminId?: string }).adminId = admin.id;
    const ev = await event();
    const me = await student("me@nyu.edu");
    await joinEvent(me.id, ev.code);
    const others = [];
    for (let i = 0; i < 7; i++) {
      const o = await student(`s${i}@${i % 2 ? "stanford" : "nyu"}.edu`);
      await joinEvent(o.id, ev.code);
      others.push(o);
    }
    const hidden = await student("hidden@nyu.edu", { visible: false });
    const unverified = await student("unv@nyu.edu", { verified: false });
    await joinEvent(hidden.id, ev.code);
    await joinEvent(unverified.id, ev.code);
    await student("notattending@nyu.edu");

    const intros = await getEventIntroductions(me, ev.id);
    expect(intros).toHaveLength(INTROS_PER_EVENT);
    const ids = intros.map((i) => i.person.userId);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(unverified.id);
    expect(intros.every((i) => i.reason.length > 10)).toBe(true);
    expect(intros.map((i) => i.rank)).toEqual([1, 2, 3, 4, 5]);
    expect((await getEventIntroductions(me, ev.id)).map((i) => i.person.userId)).toEqual(ids);

    // Saying yes on both sides creates a match the organizer can count (but not see).
    const target = intros[0]!.person.userId;
    await expressInterest(target, me.id);
    await expressInterest(me.id, target);
    expect((await getEventIntroductions(me, ev.id))[0]!.status).toBe("matched");
    expect(await getEventStats(ev.id)).toMatchObject({ attendees: 10, matches: 1 });
  });

  it("refuses non-attendees, wrong-school students and joins after the event closes", async () => {
    const admin = await createUser();
    (globalThis as { adminId?: string }).adminId = admin.id;
    const ev = await event("nyu");
    const outsider = await student("x@nyu.edu");
    await expect(getEventIntroductions(outsider, ev.id)).rejects.toThrow(/Join the event/);
    const stanford = await student("y@stanford.edu");
    await expect(joinEvent(stanford.id, ev.code)).rejects.toThrow(/NYU/);
    await setEventStatus(admin.id, ev.id, "closed");
    await expect(joinEvent(outsider.id, ev.code)).rejects.toThrow(/ended/);
  });
});
