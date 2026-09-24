import { describe, expect, it } from "vitest";
import { scoreCompatibility } from "@/server/matching/engine";
import type { MatchProfile } from "@/server/matching/types";
import { DEFAULT_MATCH_WEIGHTS } from "@/server/settings";
import { recommendationReason } from "@/server/recommendations";

function profile(overrides: Partial<MatchProfile>): MatchProfile {
  return {
    userId: crypto.randomUUID(),
    name: "Alex Doe",
    roles: [],
    skills: [],
    industries: [],
    cofounderTypesSought: [],
    stagePreferences: [],
    commitment: null,
    availability: null,
    workMode: null,
    ambition: null,
    founderExperience: null,
    city: null,
    country: null,
    timezone: "UTC",
    personality: null,
    hasStartup: false,
    ...overrides,
  };
}

const businessFounder = profile({
  name: "Lisa Moreno",
  skills: [
    { slug: "go-to-market", name: "Go-to-market", category: "business", level: 3 },
    { slug: "operations", name: "Operations", category: "operations", level: 3 },
  ],
  industries: [{ slug: "health", name: "Health" }, { slug: "ai", name: "AI" }],
  cofounderTypesSought: ["technical"],
  commitment: "full_time",
  availability: "full_time",
  ambition: "venture_scale",
  workMode: "hybrid",
  city: "New York",
  country: "United States",
  personality: { vision_operator: -50, pace: -30, risk: -20, focus: -50, structure: -30, autonomy: 30, communication: -40 },
});

const mlEngineer = profile({
  name: "Sarah Chen",
  skills: [
    { slug: "machine-learning", name: "Machine learning", category: "ai_ml", level: 3 },
    { slug: "backend", name: "Backend engineering", category: "engineering", level: 2 },
  ],
  industries: [{ slug: "health", name: "Health" }],
  cofounderTypesSought: ["business"],
  commitment: "full_time",
  availability: "full_time",
  ambition: "venture_scale",
  workMode: "hybrid",
  city: "New York",
  country: "United States",
  personality: { vision_operator: 50, pace: -20, risk: -10, focus: 50, structure: -20, autonomy: 20, communication: -30 },
});

const anotherBusinessPerson = profile({
  name: "Dan Smith",
  skills: [
    { slug: "b2b-sales", name: "B2B sales", category: "sales", level: 3 },
    { slug: "go-to-market", name: "Go-to-market", category: "business", level: 3 },
  ],
  industries: [{ slug: "fintech", name: "Fintech" }],
  cofounderTypesSought: ["technical"],
  commitment: "exploring",
  availability: "limited",
  ambition: "profitable_independent",
  workMode: "in_person",
  city: "Chicago",
  country: "United States",
});

describe("scoreCompatibility", () => {
  it("scores complementary, aligned founders highly and explains why", () => {
    const r = scoreCompatibility(businessFounder, mlEngineer, DEFAULT_MATCH_WEIGHTS);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.explanation).toMatch(/^Strong match because/);
    expect(r.explanation).toContain("complementary");
    expect(r.strengths.map((s) => s.key)).toContain("skills");
    expect(r.complementarySkills).toEqual(expect.arrayContaining(["Machine learning", "Backend engineering"]));
    expect(r.sharedInterests).toEqual(["Health"]);
  });

  it("scores overlapping skills and misaligned goals lower, with friction", () => {
    const good = scoreCompatibility(businessFounder, mlEngineer, DEFAULT_MATCH_WEIGHTS);
    const bad = scoreCompatibility(businessFounder, anotherBusinessPerson, DEFAULT_MATCH_WEIGHTS);
    expect(bad.score).toBeLessThan(good.score);
    expect(bad.score).toBeLessThan(55);
    const titles = bad.frictions.map((f) => f.title);
    expect(titles).toContain("Different end goals");
    expect(titles).toContain("Commitment gap");
  });

  it("uses neutral scores (never strengths or frictions) for missing data", () => {
    const empty = profile({ name: "Empty" });
    const r = scoreCompatibility(empty, profile({ name: "Also Empty" }), DEFAULT_MATCH_WEIGHTS);
    expect(r.score).toBe(50);
    expect(r.factors.every((f) => !f.known)).toBe(true);
    expect(r.strengths).toHaveLength(0);
    expect(r.frictions).toHaveLength(0);
    expect(r.explanation).toMatch(/no standout alignment/);
  });

  it("respects configurable weights", () => {
    const skillsOnly = { ...DEFAULT_MATCH_WEIGHTS, goals: 0, commitment: 0, industry: 0, personality: 0, workingStyle: 0, location: 0, availability: 0 };
    const r = scoreCompatibility(businessFounder, mlEngineer, skillsOnly);
    const skills = r.factors.find((f) => f.key === "skills")!;
    expect(r.score).toBe(Math.round(skills.score * 100));
  });

  it("flags large pace differences as working-style friction", () => {
    const fast = profile({ personality: { pace: -90, risk: 0 } });
    const slow = profile({ personality: { pace: 90, risk: 0 } });
    const r = scoreCompatibility(fast, slow, DEFAULT_MATCH_WEIGHTS);
    expect(r.frictions.some((f) => f.title === "Fast-moving vs Deliberate")).toBe(true);
  });

  it("rewards complementary visionary/operator pairs", () => {
    const visionary = profile({ personality: { vision_operator: -80 } });
    const operator = profile({ personality: { vision_operator: 80 } });
    const twin = profile({ personality: { vision_operator: -80 } });
    const comp = scoreCompatibility(visionary, operator, DEFAULT_MATCH_WEIGHTS).factors.find((f) => f.key === "personality")!;
    const same = scoreCompatibility(visionary, twin, DEFAULT_MATCH_WEIGHTS).factors.find((f) => f.key === "personality")!;
    expect(comp.score).toBeGreaterThan(same.score);
  });

  it("is always within 0..100", () => {
    for (const [a, b] of [
      [businessFounder, mlEngineer],
      [mlEngineer, anotherBusinessPerson],
      [anotherBusinessPerson, businessFounder],
    ] as const) {
      const r = scoreCompatibility(a, b, DEFAULT_MATCH_WEIGHTS);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("recommendationReason", () => {
  it("names the missing skills the candidate brings", () => {
    const r = scoreCompatibility(businessFounder, mlEngineer, DEFAULT_MATCH_WEIGHTS);
    expect(recommendationReason(businessFounder, mlEngineer, r)).toBe("Sarah brings AI & ML and Engineering — what you said your team is missing.");
  });
});
