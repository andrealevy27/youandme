import { describe, expect, it } from "vitest";
import { schoolForEmail } from "@/lib/schools";

describe("schoolForEmail", () => {
  it("accepts allowed domains and their subdomains", () => {
    expect(schoolForEmail("ab123@nyu.edu")?.slug).toBe("nyu");
    expect(schoolForEmail("Jane@CS.Stanford.edu")?.slug).toBe("stanford");
  });
  it("rejects lookalikes and other domains", () => {
    expect(schoolForEmail("x@notnyu.edu")).toBeNull();
    expect(schoolForEmail("x@nyu.edu.evil.com")).toBeNull();
    expect(schoolForEmail("x@gmail.com")).toBeNull();
    expect(schoolForEmail("nope")).toBeNull();
  });
});
