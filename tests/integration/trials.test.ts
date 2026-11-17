import { vi, beforeEach, describe, expect, it } from "vitest";

vi.hoisted(() => {
  process.env.STUDENT_MODE = "true";
});

import { createUser, resetDatabase } from "../support/db";
import { markSchoolVerified } from "@/server/student";
import { expressInterest } from "@/server/matching/interests";
import { checkIn, getTrial, setChecklistItem, startTrial, trialOutcome, TRIAL_DAYS } from "@/server/trials";

beforeEach(async () => {
  await resetDatabase();
});

async function matchedPair() {
  const a = await createUser({ email: "a@nyu.edu", profile: { lookingForCofounder: true } });
  const b = await createUser({ email: "b@nyu.edu", profile: { lookingForCofounder: true } });
  await markSchoolVerified(a.id, a.email);
  await markSchoolVerified(b.id, b.email);
  await expressInterest(a.id, b.id);
  const res = await expressInterest(b.id, a.id);
  if (!res.matched) throw new Error("expected a match");
  return { a, b, matchId: res.matchId };
}

describe("cofounder trials", () => {
  it("runs two weeks with a shared checklist and closes when both continue", async () => {
    const { a, b, matchId } = await matchedPair();
    const t = await startTrial(a.id, matchId);
    expect(Math.round((t.endsAt.getTime() - t.startedAt.getTime()) / 86_400_000)).toBe(TRIAL_DAYS);
    expect((await startTrial(b.id, matchId)).id).toBe(t.id); // idempotent while open

    await setChecklistItem(b.id, t.id, "equity", true);
    expect(Object.keys((await getTrial(a.id, t.id)).checklist)).toEqual(["equity"]);
    await expect(setChecklistItem(a.id, t.id, "not_a_key", true)).rejects.toThrow();

    expect((await checkIn(a.id, t.id, "continue")).outcome).toBe("active");
    expect((await checkIn(b.id, t.id, "continue")).outcome).toBe("continuing");
    expect((await getTrial(a.id, t.id)).closedAt).not.toBeNull();
  });

  it("closes as soon as either person stops, and is private to the pair", async () => {
    const { a, matchId } = await matchedPair();
    const t = await startTrial(a.id, matchId);
    const outsider = await createUser({ email: "c@nyu.edu" });
    await expect(getTrial(outsider.id, t.id)).rejects.toThrow();
    await expect(startTrial(outsider.id, matchId)).rejects.toThrow(/not found/);
    expect((await checkIn(a.id, t.id, "stop")).outcome).toBe("stopped");
    await expect(checkIn(a.id, t.id, "continue")).rejects.toThrow(/ended/);
  });

  it("asks for a check-in once the two weeks are up", () => {
    const endsAt = new Date("2026-01-15T00:00:00Z");
    expect(trialOutcome({ decisionA: null, decisionB: null, endsAt }, new Date("2026-01-10T00:00:00Z"))).toBe("active");
    expect(trialOutcome({ decisionA: "continue", decisionB: null, endsAt }, new Date("2026-01-16T00:00:00Z"))).toBe("check_in");
  });
});
