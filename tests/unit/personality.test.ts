import { describe, expect, it } from "vitest";
import { QUIZ_QUESTIONS, describeDimension, scoreQuiz } from "@/lib/personality";

describe("scoreQuiz", () => {
  it("is neutral when every answer is 3", () => {
    const answers = Object.fromEntries(QUIZ_QUESTIONS.map((q) => [q.key, 3]));
    const scores = scoreQuiz(answers);
    expect(Object.values(scores).every((v) => v === 0)).toBe(true);
  });

  it("maps agreement through polarity to the correct pole", () => {
    // Strongly agree with every "fast" statement and disagree with every "deliberate" one.
    const answers = Object.fromEntries(QUIZ_QUESTIONS.filter((q) => q.dimension === "pace").map((q) => [q.key, q.polarity === -1 ? 5 : 1]));
    expect(scoreQuiz(answers).pace).toBe(-100);
  });

  it("ignores out-of-range and missing answers", () => {
    const scores = scoreQuiz({ decide_gut: 9, speed_ship: 5 });
    expect(scores.pace).toBe(-100);
    expect(Object.keys(scores)).toEqual(["pace"]);
  });

  it("covers every dimension with at least 3 statements", () => {
    const counts = new Map<string, number>();
    for (const q of QUIZ_QUESTIONS) counts.set(q.dimension, (counts.get(q.dimension) ?? 0) + 1);
    expect([...counts.values()].every((n) => n >= 3)).toBe(true);
    expect(counts.size).toBe(7);
  });
});

describe("describeDimension", () => {
  it("describes balance, leaning and strength", () => {
    expect(describeDimension("pace", 5)).toBe("Balanced between fast-moving and deliberate");
    expect(describeDimension("pace", -40)).toBe("Leans fast-moving");
    expect(describeDimension("pace", 80)).toBe("Strongly deliberate");
  });
});
