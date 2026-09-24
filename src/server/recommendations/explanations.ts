import type { CompatibilityResult, MatchProfile } from "../matching/types";
import { getAIProvider } from "../ai/provider";
import { logger } from "../logger";

/**
 * Turns structured compatibility data into the sentence shown on a recommendation card.
 * With an AI provider configured, the model rewrites the explanation using ONLY the
 * structured facts passed in; otherwise the deterministic template is used as-is.
 */
export interface ExplanationWriter {
  write(viewer: MatchProfile, items: { candidate: MatchProfile; result: CompatibilityResult }[]): Promise<string[]>;
}

const templateWriter: ExplanationWriter = {
  async write(_viewer, items) {
    return items.map((i) => i.result.explanation);
  },
};

const aiWriter: ExplanationWriter = {
  async write(viewer, items) {
    const provider = getAIProvider();
    if (!provider || !items.length) return templateWriter.write(viewer, items);
    const facts = items.map((i, idx) => ({
      idx,
      candidateFirstName: i.candidate.name.split(" ")[0],
      score: i.result.score,
      strengths: i.result.strengths.map((f) => f.detail),
      frictions: i.result.frictions.map((f) => f.detail),
      complementarySkills: i.result.complementarySkills,
      sharedIndustries: i.result.sharedInterests,
    }));
    try {
      const text = await provider.complete({
        system:
          "You write one-sentence cofounder compatibility explanations for a startup network. Use ONLY the facts provided. Never invent experience, companies, or traits. Address the reader as 'you'. Start with 'Strong match', 'Promising match' or 'Possible match' based on score (>=80, >=65, else). Max 40 words each. Return a JSON array of strings in the same order.",
        prompt: JSON.stringify(facts),
        maxTokens: 800,
      });
      const parsed = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as unknown;
      if (Array.isArray(parsed) && parsed.length === items.length && parsed.every((s) => typeof s === "string" && s.length < 400)) {
        return parsed as string[];
      }
    } catch (err) {
      logger.warn("ai_explanations_failed", { err });
    }
    return templateWriter.write(viewer, items);
  },
};

export const explanationWriter: ExplanationWriter = {
  write: (viewer, items) => (getAIProvider() ? aiWriter : templateWriter).write(viewer, items),
};
