import { z } from "zod";
import { getAIProvider } from "../ai/provider";
import { logger } from "../logger";
import { STARTUP_STAGES } from "@/lib/domain";
import { listActiveCategories } from "./cards";
import { interpretNeedRules, parseBudgetCents, tokenize, type CategoryHint, type InterpretedNeed } from "./need-rules";

const aiSchema = z
  .object({
    categorySlugs: z.array(z.string().max(80)).max(5),
    keywords: z.array(z.string().max(40)).max(12),
    maxBudgetUsd: z.number().positive().max(10_000_000).nullable().optional(),
    stage: z.enum(STARTUP_STAGES).nullable().optional(),
  })
  .strict();

/** Extract the first JSON object from a model reply (tolerates code fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Validate a model's interpretation strictly against the real category list.
 * Returns null on any schema violation so the caller falls back to rules.
 */
export function validateAiInterpretation(raw: unknown, categories: CategoryHint[], text: string): InterpretedNeed | null {
  const parsed = aiSchema.safeParse(raw);
  if (!parsed.success) return null;
  const valid = new Set(categories.map((c) => c.slug));
  const categorySlugs = [...new Set(parsed.data.categorySlugs)].filter((s) => valid.has(s)).slice(0, 3);
  const keywords = [...new Set(parsed.data.keywords.map((k) => k.toLowerCase().trim()).filter((k) => /^[a-z0-9][a-z0-9 +.-]{0,38}$/.test(k)))].slice(0, 10);
  if (!categorySlugs.length && !keywords.length) return null;
  // Budget must be grounded in the text: prefer the deterministic parse; accept the model's only if a number appears.
  const ruleBudget = parseBudgetCents(text);
  const aiBudget = parsed.data.maxBudgetUsd && /\d/.test(text) ? Math.round(parsed.data.maxBudgetUsd * 100) : null;
  return {
    categorySlugs,
    keywords: keywords.length ? keywords : tokenize(text).slice(0, 10),
    maxBudgetCents: ruleBudget ?? aiBudget,
    ...(parsed.data.stage ? { stage: parsed.data.stage } : {}),
  };
}

/**
 * "Describe what you need" → structured search intent. Uses the AI provider when
 * configured (strictly validated), otherwise — or on any failure — deterministic rules.
 */
export async function interpretNeed(text: string): Promise<InterpretedNeed & { source: "ai" | "rules" }> {
  const clean = text.trim().slice(0, 2000);
  const categories = await listActiveCategories();
  const rules = interpretNeedRules(clean, categories);
  const ai = getAIProvider();
  if (!ai || clean.length < 8) return { ...rules, source: "rules" };
  try {
    const reply = await ai.complete({
      system:
        "You map a startup founder's request to a consultant marketplace taxonomy. Reply with ONLY a JSON object: " +
        '{"categorySlugs": string[] (1-3 slugs chosen ONLY from the provided list), "keywords": string[] (up to 8 short lowercase search terms taken from the request), ' +
        '"maxBudgetUsd": number|null (only if the request states a budget), "stage": one of ' +
        JSON.stringify(STARTUP_STAGES) +
        " or null (only if stated). Never invent facts.",
      prompt: `Categories:\n${categories.map((c) => `- ${c.slug}: ${c.name} (${c.keywords.join(", ")})`).join("\n")}\n\nRequest:\n"""${clean}"""`,
      maxTokens: 1500,
    });
    const validated = validateAiInterpretation(extractJson(reply), categories, clean);
    if (validated) return { ...validated, source: "ai" };
    logger.warn("need_interpreter_ai_invalid", {});
  } catch (err) {
    logger.warn("need_interpreter_ai_failed", { err });
  }
  return { ...rules, source: "rules" };
}
