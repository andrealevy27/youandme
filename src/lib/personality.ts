/**
 * You&Me working-style model. This is a self-reported description of how someone
 * likes to build — not a clinical or psychometric instrument.
 *
 * Scores per dimension live in [-100, 100]: negative leans to the left pole.
 */

export const DIMENSIONS = {
  vision_operator: { left: "Visionary", right: "Operator", pairing: "complement" },
  pace: { left: "Fast-moving", right: "Deliberate", pairing: "similar" },
  structure: { left: "Structured", right: "Flexible", pairing: "similar" },
  autonomy: { left: "Independent", right: "Collaborative", pairing: "similar" },
  risk: { left: "Risk-seeking", right: "Risk-conscious", pairing: "similar" },
  communication: { left: "Direct", right: "Diplomatic", pairing: "similar" },
  focus: { left: "Big-picture", right: "Detail-oriented", pairing: "complement" },
} as const;

export type DimensionKey = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as DimensionKey[];

/** Dimensions that feed the "personality" factor vs the "working style" factor in matching. */
export const PERSONALITY_FACTOR_DIMENSIONS: DimensionKey[] = ["vision_operator", "pace", "risk", "focus"];
export const WORKING_STYLE_FACTOR_DIMENSIONS: DimensionKey[] = ["structure", "autonomy", "communication"];

export type QuizQuestion = {
  key: string;
  topic: string;
  prompt: string;
  dimension: DimensionKey;
  /** +1: agreeing pushes toward the right pole; -1: toward the left pole. */
  polarity: 1 | -1;
};

export const QUIZ_VERSION = 1;

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { key: "decide_gut", topic: "Decision making", prompt: "I'm comfortable making a big call with 60% of the information.", dimension: "pace", polarity: -1 },
  { key: "vision_story", topic: "Ambition", prompt: "I get more energy from imagining where the company could be in ten years than from this week's plan.", dimension: "vision_operator", polarity: -1 },
  { key: "conflict_direct", topic: "Conflict", prompt: "When I disagree with a cofounder, I say so plainly, right away.", dimension: "communication", polarity: -1 },
  { key: "risk_bet", topic: "Risk", prompt: "I'd rather take a bold bet that might fail than a safe path that probably works.", dimension: "risk", polarity: -1 },
  { key: "plan_weekly", topic: "Planning", prompt: "I like having a written plan and clear priorities for every week.", dimension: "structure", polarity: -1 },
  { key: "solo_deep", topic: "Independence", prompt: "I do my best work alone with long, uninterrupted blocks of time.", dimension: "autonomy", polarity: -1 },
  { key: "details_ship", topic: "Ownership", prompt: "I notice the small details other people miss before something ships.", dimension: "focus", polarity: 1 },
  { key: "ops_systems", topic: "Leadership", prompt: "I enjoy building the systems and processes that make a team run smoothly.", dimension: "vision_operator", polarity: 1 },
  { key: "speed_ship", topic: "Speed", prompt: "Shipping something imperfect today beats shipping something polished next month.", dimension: "pace", polarity: -1 },
  { key: "feedback_soft", topic: "Feedback", prompt: "I think carefully about how feedback will land before I give it.", dimension: "communication", polarity: 1 },
  { key: "runway_safe", topic: "Risk", prompt: "Protecting runway matters more to me than chasing every growth opportunity.", dimension: "risk", polarity: 1 },
  { key: "adapt_plans", topic: "Structure", prompt: "I'm happy to throw out the plan when something better comes along.", dimension: "structure", polarity: 1 },
  { key: "collab_whiteboard", topic: "Collaboration", prompt: "I think best when I'm working through problems out loud with someone else.", dimension: "autonomy", polarity: 1 },
  { key: "bigpicture_strategy", topic: "Ambition", prompt: "I'm most useful setting direction, not managing the specifics.", dimension: "focus", polarity: -1 },
  { key: "stress_process", topic: "Stress", prompt: "Under pressure, I slow down and double-check before acting.", dimension: "pace", polarity: 1 },
  { key: "accountability_metrics", topic: "Accountability", prompt: "I like tracking commitments and numbers so everyone knows where we stand.", dimension: "vision_operator", polarity: 1 },
  { key: "hours_rhythm", topic: "Work hours", prompt: "I prefer a predictable rhythm over bursts of intense, irregular work.", dimension: "structure", polarity: -1 },
  { key: "consensus", topic: "Collaboration", prompt: "Important decisions should be made together, even if it takes longer.", dimension: "autonomy", polarity: 1 },
  { key: "risk_quit", topic: "Risk", prompt: "I'd leave a stable job for an idea I believe in, even without funding.", dimension: "risk", polarity: -1 },
  { key: "conflict_harmony", topic: "Conflict", prompt: "I'd rather find common ground than win an argument.", dimension: "communication", polarity: 1 },
  { key: "focus_specs", topic: "Planning", prompt: "Before building, I want the specifics nailed down.", dimension: "focus", polarity: 1 },
];

export const LIKERT_OPTIONS = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
] as const;

/** Pure scoring: answers (1..5) keyed by question key → per-dimension score in [-100, 100]. */
export function scoreQuiz(
  answers: Record<string, number>,
  questions: Pick<QuizQuestion, "key" | "dimension" | "polarity">[] = QUIZ_QUESTIONS,
): Partial<Record<DimensionKey, number>> {
  const sums = new Map<DimensionKey, { total: number; count: number }>();
  for (const q of questions) {
    const v = answers[q.key];
    if (v === undefined || v < 1 || v > 5) continue;
    const contribution = ((v - 3) / 2) * q.polarity;
    const s = sums.get(q.dimension) ?? { total: 0, count: 0 };
    s.total += contribution;
    s.count += 1;
    sums.set(q.dimension, s);
  }
  const out: Partial<Record<DimensionKey, number>> = {};
  for (const [dim, { total, count }] of sums) out[dim] = Math.round((total / count) * 100);
  return out;
}

/** Human description of where someone sits on a dimension. */
export function describeDimension(key: DimensionKey, score: number): string {
  const d = DIMENSIONS[key];
  const abs = Math.abs(score);
  if (abs < 20) return `Balanced between ${d.left.toLowerCase()} and ${d.right.toLowerCase()}`;
  const pole = score < 0 ? d.left : d.right;
  return abs >= 60 ? `Strongly ${pole.toLowerCase()}` : `Leans ${pole.toLowerCase()}`;
}
