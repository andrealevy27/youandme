import { describe, expect, it } from "vitest";
import { matchConsultantCategories, parseBudgetCents, routeIntent, topicOf } from "../../src/server/ai/intent";
import { selectCards } from "../../src/server/ai/select-cards";
import { parseBlocks } from "../../src/components/ai/markdown-lite";

const tools = (msg: string) => routeIntent(msg).actions.map((a) => a.tool);

describe("routeIntent (basic mode)", () => {
  it("routes the six suggestion prompts", () => {
    expect(routeIntent("I need someone to help with fundraising.").kind).toBe("consultant");
    expect(tools("I need someone to help with fundraising.")).toEqual(["searchConsultants", "searchPeople"]);

    const cof = routeIntent("I need a technical cofounder who understands computer vision.");
    expect(cof.kind).toBe("cofounder");
    expect(cof.actions[0]).toMatchObject({ tool: "searchPeople", tab: "cofounders" });
    expect((cof.actions[0] as { query: string }).query).toContain("computer vision");

    expect(routeIntent("Who should I hire next?")).toMatchObject({ kind: "hire", actions: [{ tool: "analyzeTeamGaps" }] });

    expect(tools("Find me someone who can redesign our onboarding.")).toEqual(["searchPeople", "searchConsultants"]);

    expect(routeIntent("What are the biggest gaps in my founding team?")).toMatchObject({ kind: "gaps", actions: [{ tool: "analyzeTeamGaps" }] });

    const tiktok = routeIntent("I need a consultant for TikTok growth under $500.");
    expect(tiktok.kind).toBe("consultant");
    expect(tiktok.actions[0]).toMatchObject({ tool: "searchConsultants", maxBudgetCents: 50_000 });
    expect((tiktok.actions[0] as { query: string }).query.toLowerCase()).toBe("tiktok growth");
  });

  it("routes matches and falls back to a broad search", () => {
    expect(tools("show me my matches")).toEqual(["getMatches"]);
    expect(tools("climate")).toEqual(["searchPeople", "searchConsultants"]);
  });

  it("parses budgets", () => {
    expect(parseBudgetCents("under $500")).toBe(50_000);
    expect(parseBudgetCents("budget of 2k")).toBe(200_000);
    expect(parseBudgetCents("$1,500 max")).toBe(150_000);
    expect(parseBudgetCents("a team of 5 engineers")).toBeUndefined();
  });

  it("strips conversational scaffolding", () => {
    expect(topicOf("Find me someone who can redesign our onboarding.")).toBe("redesign onboarding");
  });
});

describe("matchConsultantCategories", () => {
  const cats = [
    { slug: "growth", name: "Growth", keywords: ["tiktok", "viral"] },
    { slug: "fundraising", name: "Fundraising", keywords: ["investors", "seed"] },
    { slug: "ux-ui", name: "UX/UI", keywords: ["onboarding", "redesign"] },
  ];
  it("matches by name, slug and keyword", () => {
    expect(matchConsultantCategories("TikTok growth", cats).map((c) => c.slug)).toEqual(["growth"]);
    expect(matchConsultantCategories("redesign onboarding", cats).map((c) => c.slug)).toEqual(["ux-ui"]);
    expect(matchConsultantCategories("talk to seed investors", cats).map((c) => c.slug)).toEqual(["fundraising"]);
  });
});

describe("selectCards", () => {
  const a = { kind: "person" as const, id: "1", name: "Sarah Chen" };
  const b = { kind: "person" as const, id: "2", name: "Marcus Adeyemi" };
  const c = { kind: "consultant" as const, id: "3", name: "Maya Goldberg" };
  it("keeps only tool results mentioned in the answer, in mention order", () => {
    expect(selectCards("Talk to **Maya Goldberg**, then Sarah Chen.", [a, b, c], [a, b])).toEqual([c, a]);
  });
  it("never includes a name the tools did not return", () => {
    expect(selectCards("Meet **Invented Person**.", [a], [])).toEqual([]);
  });
  it("falls back to the last search's top results", () => {
    expect(selectCards("Here are a few options.", [a, b, c], [a, b, c, a], { fallback: 3 })).toHaveLength(3);
  });
  it("dedupes an entity returned as both person and consultant", () => {
    const cp = { kind: "consultant" as const, id: "1", name: "Sarah Chen" };
    expect(selectCards("Sarah Chen", [cp, a], [])).toEqual([cp]);
  });
});

describe("markdown-lite parseBlocks", () => {
  it("parses paragraphs, bullets and numbered lists", () => {
    const blocks = parseBlocks("Intro line\nsecond line\n\n- **A** one\n- B\n\n1. first\n2. second");
    expect(blocks).toEqual([
      { type: "p", lines: ["Intro line", "second line"] },
      { type: "ul", items: ["**A** one", "B"] },
      { type: "ol", items: ["first", "second"] },
    ]);
  });
});
