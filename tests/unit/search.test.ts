import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, extractSearchTerms, matchUniversities } from "../../src/server/search/terms";

const vocab = {
  skills: [
    { id: "s1", slug: "computer-vision", name: "Computer vision", category: "ai_ml" },
    { id: "s2", slug: "backend", name: "Backend engineering", category: "engineering" },
    { id: "s3", slug: "product-management", name: "Product management", category: "product" },
    { id: "s4", slug: "healthcare", name: "Healthcare domain", category: "domain" },
  ],
  industries: [
    { id: "i1", slug: "health", name: "Health" },
    { id: "i2", slug: "ai", name: "AI" },
    { id: "i3", slug: "fintech", name: "Fintech" },
  ],
  universities: ["NYU", "Columbia University", "Stanford University", "University of Waterloo"],
};

describe("extractSearchTerms", () => {
  it("understands the Discover example query", () => {
    const t = extractSearchTerms("AI engineer at NYU interested in health startups", vocab);
    expect(t.categories).toEqual(expect.arrayContaining(["ai_ml", "engineering"]));
    expect(t.industryNames).toEqual(expect.arrayContaining(["AI", "Health"]));
    expect(t.universities).toEqual(["NYU"]);
    expect(t.text).toBe("ai engineer nyu health");
  });

  it("matches skill names and their stems", () => {
    expect(extractSearchTerms("computer vision person", vocab).skillIds).toEqual(["s1"]);
    expect(extractSearchTerms("a backend dev", vocab).skillIds).toEqual(["s2"]);
    expect(extractSearchTerms("healthcare operator", vocab).skillIds).toEqual(["s4"]);
    // "product" alone is too generic to count as the Product management skill.
    expect(extractSearchTerms("product person", vocab).skillIds).toEqual([]);
  });

  it("maps healthcare to the Health industry", () => {
    expect(extractSearchTerms("healthcare founders", vocab).industryIds).toEqual(["i1"]);
  });
});

describe("matchUniversities", () => {
  it("matches names, short names and acronyms", () => {
    expect(matchUniversities("went to Stanford", vocab.universities)).toEqual(["Stanford University"]);
    expect(matchUniversities("columbia alumni", vocab.universities)).toEqual(["Columbia University"]);
    expect(matchUniversities("waterloo grads", vocab.universities)).toEqual(["University of Waterloo"]);
    expect(matchUniversities("nothing here", vocab.universities)).toEqual([]);
  });
});

describe("cursor", () => {
  it("round-trips and rejects junk", () => {
    expect(decodeCursor(encodeCursor(24))).toBe(24);
    expect(decodeCursor("garbage")).toBe(0);
    expect(decodeCursor(null)).toBe(0);
  });
});
