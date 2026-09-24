import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, toFailure } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";
import { isAcademicDomain } from "@/server/verification";
import { safeUrl, formatMoney } from "@/lib/utils";
import { slugify } from "@/lib/slug";
import { localDateFor } from "@/server/recommendations";

describe("toFailure", () => {
  it("passes AppError messages through", () => {
    expect(toFailure(new AppError("FORBIDDEN", "Nope."))).toEqual({ ok: false, error: "Nope.", code: "FORBIDDEN" });
  });
  it("maps zod errors to field errors", () => {
    const res = z.object({ name: z.string().min(2, "Too short") }).safeParse({ name: "a" });
    const f = toFailure(res.error);
    expect(f.code).toBe("VALIDATION");
    expect(f.fieldErrors).toEqual({ name: ["Too short"] });
  });
  it("hides unknown errors behind a friendly message", () => {
    const f = toFailure(new Error("relation does not exist"), "We couldn't load your matches. Try again.");
    expect(f.error).toBe("We couldn't load your matches. Try again.");
    expect(JSON.stringify(f)).not.toContain("relation");
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window then blocks, and resets", () => {
    const rule = { limit: 2, windowMs: 1000 };
    const key = `t-${Math.random()}`;
    expect(checkRateLimit(key, rule, 0).allowed).toBe(true);
    expect(checkRateLimit(key, rule, 10).allowed).toBe(true);
    expect(checkRateLimit(key, rule, 20).allowed).toBe(false);
    expect(checkRateLimit(key, rule, 1001).allowed).toBe(true);
  });
});

describe("utilities", () => {
  it("only allows http(s) URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("https://example.com/x")).toBe("https://example.com/x");
  });
  it("slugifies", () => {
    expect(slugify("You&Me Admin")).toBe("you-me-admin");
    expect(slugify("Crème Brûlée!!")).toBe("creme-brulee");
  });
  it("formats money", () => {
    expect(formatMoney(25000)).toBe("$250");
    expect(formatMoney(1999)).toBe("$19.99");
  });
  it("recognises academic domains conservatively", () => {
    expect(isAcademicDomain("nyu.edu")).toBe(true);
    expect(isAcademicDomain("ox.ac.uk")).toBe(true);
    expect(isAcademicDomain("gmail.com")).toBe(false);
    expect(isAcademicDomain("edu.com")).toBe(false);
  });
  it("computes the local recommendation date per timezone", () => {
    const now = new Date("2026-03-10T02:00:00Z");
    expect(localDateFor("UTC", now)).toBe("2026-03-10");
    expect(localDateFor("America/New_York", now)).toBe("2026-03-09");
    expect(localDateFor("Not/AZone", now)).toBe("2026-03-10");
  });
});
