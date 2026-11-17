import { describe, expect, it } from "vitest";
import { oneLineReason, studentReasons, type StudentFacts } from "@/server/student/reasons";
import type { CompatibilityResult } from "@/server/matching/types";

const result = (over: Partial<CompatibilityResult> = {}): CompatibilityResult => ({
  score: 70,
  factors: [],
  strengths: [],
  frictions: [],
  sharedInterests: [],
  complementarySkills: [],
  explanation: "Promising match because your available time lines up.",
  algorithmVersion: "test",
  ...over,
});
const facts = (over: Partial<StudentFacts> = {}): StudentFacts => ({ name: "Ana Lopez", school: "nyu", ideaStatus: null, ideaSummary: null, weeklyHours: null, summerPlans: null, ...over });

describe("student reasons", () => {
  it("leads with idea fit and adds the strongest second fact", () => {
    const me = facts({ name: "Me", ideaStatus: "have_idea", weeklyHours: 8 });
    expect(oneLineReason(me, facts({ ideaStatus: "join_one" }), result({ complementarySkills: ["B2B sales"] }))).toBe(
      "Ana wants to join an idea and brings B2B sales — what you're looking for.",
    );
    expect(oneLineReason(me, facts({ ideaStatus: "join_one", weeklyHours: 9 }), result())).toBe("Ana wants to join an idea and has the same 5–10 hrs/week as you.");
  });

  it("quotes the other person's idea when you want to join one", () => {
    const r = studentReasons(facts({ name: "Me", ideaStatus: "join_one" }), facts({ ideaStatus: "have_idea", ideaSummary: "Lab gear marketplace" }), result());
    expect(r[0]).toBe("Ana has an idea and needs a team: “Lab gear marketplace”");
  });

  it("mentions cross-campus and shared interests, and falls back to the engine's explanation", () => {
    const r = studentReasons(facts({ name: "Me" }), facts({ school: "stanford" }), result({ sharedInterests: ["Education", "Climate"] }));
    expect(r).toEqual(["You both care about Education and Climate.", "Ana is at Stanford — a cross-campus team."]);
    expect(studentReasons(facts({ name: "Me" }), facts({ school: "nyu" }), result())).toEqual(["Promising match because your available time lines up."]);
  });
});
