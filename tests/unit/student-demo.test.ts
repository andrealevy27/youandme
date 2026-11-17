import { describe, expect, it } from "vitest";
import { buildDemo } from "@/server/student/demo";

describe("demo", () => {
  it("ranks every sample student for both personas with real reasons", () => {
    const personas = buildDemo();
    expect(personas.map((p) => p.key)).toEqual(["idea", "join"]);
    for (const p of personas) {
      expect(p.people).toHaveLength(12);
      const scores = p.people.map((x) => x.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
      expect(p.people.every((x) => x.oneLiner.length > 10 && x.reasons.length > 0)).toBe(true);
    }
  });
});
