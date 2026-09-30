import { describe, expect, it } from "vitest";
import {
  bpsToPercentLabel,
  chunk,
  escapeHtml,
  generateInviteCode,
  inviteState,
  isValidWeights,
  likePattern,
  normaliseWeights,
  pageCount,
  pageOffset,
  param,
  parseKeywords,
  parsePage,
  pickEnum,
  ratio,
  safeLinkedIn,
  suspensionEnd,
  toCsv,
} from "../../src/server/admin/utils";
import { ADMIN_NAV, visibleAdminNav } from "../../src/server/admin/nav";
import type { MatchWeights } from "../../src/server/matching/types";

const DEFAULT_WEIGHTS_FIXTURE: MatchWeights = {
  skills: 25,
  goals: 15,
  commitment: 15,
  industry: 10,
  personality: 15,
  workingStyle: 10,
  location: 5,
  availability: 5,
};

describe("admin pagination helpers", () => {
  it("parses page numbers defensively", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["7", "2"])).toBe(7);
    expect(parsePage("999999999")).toBe(10_000);
  });

  it("computes offsets and page counts", () => {
    expect(pageOffset(1)).toBe(0);
    expect(pageOffset(3)).toBe(50);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
  });

  it("reads params and enums", () => {
    expect(param({ q: "  lisa " }, "q")).toBe("lisa");
    expect(param({ q: "   " }, "q")).toBeUndefined();
    expect(pickEnum("open", ["open", "dismissed"] as const, "dismissed")).toBe("open");
    expect(pickEnum("drop table", ["open", "dismissed"] as const, "open")).toBe("open");
  });

  it("escapes LIKE wildcards", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("matching weight normalisation", () => {
  it("always sums to 100", () => {
    const pct = normaliseWeights(DEFAULT_WEIGHTS_FIXTURE);
    expect(Object.values(pct).reduce((a, b) => a + b, 0)).toBe(100);
    expect(pct.skills).toBe(25);
  });

  it("handles awkward thirds with largest remainder rounding", () => {
    const pct = normaliseWeights({ skills: 1, goals: 1, commitment: 1 });
    expect(pct.skills + pct.goals + pct.commitment).toBe(100);
    expect(pct.industry).toBe(0);
  });

  it("returns zeros when everything is zero and ignores junk", () => {
    const pct = normaliseWeights({ skills: 0, goals: Number.NaN, commitment: -5 });
    expect(Object.values(pct).every((v) => v === 0)).toBe(true);
  });

  it("validates weights", () => {
    expect(isValidWeights(DEFAULT_WEIGHTS_FIXTURE)).toBe(true);
    expect(isValidWeights({ ...DEFAULT_WEIGHTS_FIXTURE, skills: 101 })).toBe(false);
    expect(isValidWeights({ ...DEFAULT_WEIGHTS_FIXTURE, skills: 2.5 })).toBe(false);
    const zeros = Object.fromEntries(Object.keys(DEFAULT_WEIGHTS_FIXTURE).map((k) => [k, 0])) as typeof DEFAULT_WEIGHTS_FIXTURE;
    expect(isValidWeights(zeros)).toBe(false);
  });
});

describe("misc admin helpers", () => {
  it("parses category keywords", () => {
    expect(parseKeywords("TikTok, paid  social ,, seo, tiktok")).toEqual(["tiktok", "paid social", "seo"]);
    expect(parseKeywords(undefined)).toEqual([]);
  });

  it("formats commission", () => {
    expect(bpsToPercentLabel(1000)).toBe("10%");
    expect(bpsToPercentLabel(1250)).toBe("12.5%");
    expect(bpsToPercentLabel(0)).toBe("0%");
  });

  it("computes suspension end", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(suspensionEnd(7, now)?.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(suspensionEnd(null, now)).toBeNull();
  });

  it("generates unambiguous invite codes", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });

  it("derives invite state", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(inviteState({ uses: 0, maxUses: 1, expiresAt: null }, now)).toBe("active");
    expect(inviteState({ uses: 1, maxUses: 1, expiresAt: null }, now)).toBe("used");
    expect(inviteState({ uses: 0, maxUses: 5, expiresAt: now }, now)).toBe("expired");
  });

  it("returns null ratios for empty denominators (rendered as an em dash)", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 3)).toBe(33.3);
  });

  it("chunks batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("escapes html and only links real LinkedIn URLs", () => {
    expect(escapeHtml(`<b>"x"&'y'</b>`)).toBe("&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;");
    expect(safeLinkedIn("https://www.linkedin.com/in/lisa")).toBe("https://www.linkedin.com/in/lisa");
    expect(safeLinkedIn("javascript:alert(1)")).toBeNull();
    expect(safeLinkedIn("https://linkedin.com.evil.io/in/x")).toBeNull();
  });
});

describe("admin navigation permissions", () => {
  it("shows everything to super admins", () => {
    expect(visibleAdminNav("super_admin")).toHaveLength(ADMIN_NAV.length);
  });

  it("hides sections the role can't use", () => {
    const finance = visibleAdminNav("finance").map((i) => i.href);
    expect(finance).toContain("/admin/bookings");
    expect(finance).toContain("/admin");
    expect(finance).not.toContain("/admin/users");
    expect(finance).not.toContain("/admin/settings");

    const moderator = visibleAdminNav("moderator").map((i) => i.href);
    expect(moderator).toContain("/admin/reports");
    expect(moderator).not.toContain("/admin");
    expect(moderator).not.toContain("/admin/notifications");
  });

  it("shows nothing without an admin role", () => {
    expect(visibleAdminNav(null)).toEqual([]);
  });
});

describe("toCsv", () => {
  it("quotes separators, quotes and newlines, and blanks nulls", () => {
    expect(toCsv([["a", 'say "hi"', "x,y", null, 3], ["line\nbreak", undefined, "", "ok", 0]])).toBe(
      'a,"say ""hi""","x,y",,3\r\n"line\nbreak",,,ok,0\r\n',
    );
  });

  it("neutralises spreadsheet formulas", () => {
    expect(toCsv([["=HYPERLINK(1)", "+SUM(A1)", "-2", "@cmd", "safe=1"]])).toBe("'=HYPERLINK(1),'+SUM(A1),'-2,'@cmd,safe=1\r\n");
  });

  it("leaves phone numbers readable", () => {
    expect(toCsv([["+1 (212) 555-0100", "+44 20 7946 0958"]])).toBe("+1 (212) 555-0100,+44 20 7946 0958\r\n");
  });
});
