import { describe, expect, it } from "vitest";
import { isSelfReport, reportInput } from "../../src/server/moderation/schema";

describe("report input", () => {
  it("accepts a valid report and trims details", () => {
    const r = reportInput.parse({ targetType: "message", targetId: "abc", reason: "harassment", details: "  rude  " });
    expect(r).toEqual({ targetType: "message", targetId: "abc", reason: "harassment", details: "rude" });
  });

  it("rejects unknown targets and reasons", () => {
    expect(reportInput.safeParse({ targetType: "comment", targetId: "x", reason: "spam" }).success).toBe(false);
    expect(reportInput.safeParse({ targetType: "user", targetId: "x", reason: "boring" }).success).toBe(false);
    expect(reportInput.safeParse({ targetType: "user", targetId: " ", reason: "spam" }).success).toBe(false);
  });

  it("caps details length", () => {
    expect(reportInput.safeParse({ targetType: "user", targetId: "x", reason: "other", details: "a".repeat(2001) }).success).toBe(false);
  });

  it("flags self-reports except for startups", () => {
    expect(isSelfReport("message", "me", "me")).toBe(true);
    expect(isSelfReport("user", "someone", "me")).toBe(false);
    expect(isSelfReport("startup", "me", "me")).toBe(false);
  });
});
