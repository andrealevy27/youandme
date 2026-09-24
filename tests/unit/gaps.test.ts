import { describe, expect, it } from "vitest";
import { computeCapabilityGaps, requiredCapabilities, summarizeGaps, type CapabilityInput } from "../../src/server/ai/gaps-model";

const kinwell: CapabilityInput = {
  startup: {
    name: "Kinwell",
    industries: ["health", "ai", "consumer"],
    businessModel: "b2c",
    stage: "validation",
    fundingStatus: "bootstrapped",
    openNeeds: [{ title: "Technical cofounder", categories: ["engineering", "ai_ml"] }],
  },
  team: [
    {
      name: "Lisa Moreno",
      skills: [
        { slug: "operations", category: "operations" },
        { slug: "go-to-market", category: "business" },
        { slug: "user-interviews", category: "product" },
        { slug: "healthcare", category: "domain" },
      ],
    },
  ],
};

describe("requiredCapabilities", () => {
  it("maps AI to ai_ml + engineering (critical)", () => {
    const reqs = requiredCapabilities({ name: "X", industries: ["AI"], businessModel: null, stage: "idea" });
    const byCat = Object.fromEntries(reqs.map((r) => [r.category, r.severity]));
    expect(byCat.ai_ml).toBe("critical");
    expect(byCat.engineering).toBe("critical");
  });

  it("maps B2B SaaS to engineering, product and sales", () => {
    const cats = requiredCapabilities({ name: "X", industries: [], businessModel: "b2b_saas", stage: "mvp" }).map((r) => r.category);
    expect(cats).toEqual(expect.arrayContaining(["engineering", "product", "sales"]));
  });

  it("maps fintech to finance + legal and fundraising stage to finance", () => {
    const fin = requiredCapabilities({ name: "X", industries: ["Fintech"], businessModel: null, stage: "mvp" }).map((r) => r.category);
    expect(fin).toEqual(expect.arrayContaining(["finance", "legal"]));
    const raising = requiredCapabilities({ name: "X", industries: [], businessModel: "services", stage: "fundraising" }).map((r) => r.category);
    expect(raising).toContain("finance");
    expect(raising).not.toContain("engineering");
  });

  it("merges duplicate categories keeping the highest severity", () => {
    const reqs = requiredCapabilities({ name: "X", industries: ["AI", "B2B SaaS"], businessModel: "b2b_saas", stage: "mvp" });
    const eng = reqs.filter((r) => r.category === "engineering");
    expect(eng).toHaveLength(1);
    expect(eng[0]!.severity).toBe("critical");
  });
});

describe("computeCapabilityGaps", () => {
  it("flags engineering and AI for Kinwell with an explicit reason", () => {
    const { gaps, covered } = computeCapabilityGaps(kinwell);
    const eng = gaps.find((g) => g.category === "engineering");
    const ai = gaps.find((g) => g.category === "ai_ml");
    expect(eng?.severity).toBe("critical");
    expect(ai?.severity).toBe("critical");
    expect(eng!.reason).toContain("no one lists Engineering or AI & ML");
    expect(eng!.reason).toContain("Kinwell is an AI product");
    expect(eng!.reason).toMatch(/^Your team has .*Operations.*Business & strategy/);
    expect(eng!.reason).toContain('"Technical cofounder"');
    // Critical gaps first.
    expect(gaps.slice(0, 2).map((g) => g.category).sort()).toEqual(["ai_ml", "engineering"]);
    expect(covered.map((c) => c.category)).toEqual(expect.arrayContaining(["operations", "business", "product", "domain"]));
  });

  it("does not flag healthcare domain when a member has the healthcare skill", () => {
    const { gaps } = computeCapabilityGaps(kinwell);
    expect(gaps.some((g) => g.category === "domain")).toBe(false);
    expect(gaps.find((g) => g.category === "legal")?.label).toBe("Compliance & legal");
  });

  it("flags consumer design and growth", () => {
    const cats = computeCapabilityGaps(kinwell).gaps.map((g) => g.category);
    expect(cats).toEqual(expect.arrayContaining(["design", "growth"]));
  });

  it("returns no gaps when the team covers everything", () => {
    const { gaps } = computeCapabilityGaps({
      startup: { name: "Tidy", industries: ["Developer tools"], businessModel: "b2b_saas", stage: "mvp" },
      team: [
        { name: "A", skills: [{ slug: "backend", category: "engineering" }, { slug: "pm", category: "product" }] },
        { name: "B", skills: [{ slug: "b2b-sales", category: "sales" }, { slug: "community", category: "growth" }] },
      ],
    });
    expect(gaps).toEqual([]);
    expect(summarizeGaps("Tidy", gaps)).toContain("covers");
  });

  it("describes an empty team honestly", () => {
    const { gaps } = computeCapabilityGaps({ startup: { name: "Solo", industries: ["AI"], businessModel: null, stage: "idea" }, team: [] });
    expect(gaps[0]!.reason).toMatch(/^Your team has no members listed yet/);
  });
});
