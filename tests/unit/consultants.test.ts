import { describe, expect, it } from "vitest";
import { interpretNeedRules, matchCategories, parseBudgetCents, parseStage } from "../../src/server/consultants/need-rules";
import { CONSULTANT_CATEGORIES } from "../../src/server/db/seed/reference";

describe("parseBudgetCents", () => {
  it.each([
    ["under $500", 50_000],
    ["Budget of $1,500 for this", 150_000],
    ["up to 2k", 200_000],
    ["no more than $300", 30_000],
    ["<$250", 25_000],
    ["$800 max", 80_000],
  ])("%s → %s", (text, cents) => {
    expect(parseBudgetCents(text)).toBe(cents);
  });
  it("returns null without a budget", () => {
    expect(parseBudgetCents("We need help with our pitch deck")).toBeNull();
    expect(parseBudgetCents("We have 3 founders")).toBeNull();
  });
});

describe("parseStage", () => {
  it("detects stages", () => {
    expect(parseStage("We're pre-revenue")).toBe("pre_revenue");
    expect(parseStage("just launched our MVP")).toBe("mvp");
    expect(parseStage("we're validating the idea")).toBe("validation");
    expect(parseStage("hello")).toBeUndefined();
  });
});

describe("interpretNeedRules", () => {
  it("maps the TikTok example to growth/marketing", () => {
    const r = interpretNeedRules(
      "We are launching a consumer AI app and need someone who can help us build a TikTok acquisition strategy under $500.",
      CONSULTANT_CATEGORIES,
    );
    expect(r.categorySlugs).toContain("growth");
    expect(r.categorySlugs).toContain("marketing");
    expect(r.keywords).toContain("tiktok");
    expect(r.maxBudgetCents).toBe(50_000);
  });

  it("maps legal requests", () => {
    const r = interpretNeedRules("Need a lawyer to help with incorporation and founder equity", CONSULTANT_CATEGORIES);
    expect(r.categorySlugs[0]).toBe("legal");
  });

  it("uses word boundaries for short keywords", () => {
    // "ai" should not match inside "maintain" or "email".
    const cats = matchCategories("maintain our email list", CONSULTANT_CATEGORIES).map((c) => c.slug);
    expect(cats).not.toContain("ai");
  });

  it("returns no categories for unrelated text", () => {
    expect(interpretNeedRules("hello there", CONSULTANT_CATEGORIES).categorySlugs).toEqual([]);
  });
});
