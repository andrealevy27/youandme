import Anthropic from "@anthropic-ai/sdk";
import { env, features } from "../env";
import { logger } from "../logger";

/**
 * Provider-neutral AI interface. The concierge, explanation writer and need
 * interpreter depend only on this — swap providers by adding an implementation.
 */
export type AIToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema for the tool input. */
  inputSchema: Record<string, unknown>;
};

export type AIChatTurn = { role: "user" | "assistant"; content: string };

export type ToolExecutor = (name: string, input: unknown) => Promise<unknown>;

export interface AIProvider {
  readonly name: string;
  complete(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
  /** Runs a model ↔ tool loop until the model answers (or `maxSteps` is hit). */
  runWithTools(opts: {
    system: string;
    history: AIChatTurn[];
    tools: AIToolDefinition[];
    execute: ToolExecutor;
    maxSteps?: number;
  }): Promise<{ text: string; trace: { tool: string; input: unknown }[] }>;
}

class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 60_000 });

  private base() {
    return {
      model: env.AI_MODEL,
      // Server-side refusal fallback routes declined requests to an appropriate model.
      betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
      fallbacks: "default" as const,
      thinking: { type: "adaptive" as const },
      // Chat/concierge is latency-sensitive; medium effort keeps it snappy.
      output_config: { effort: "medium" as const },
    };
  }

  private textOf(msg: Anthropic.Beta.BetaMessage) {
    if (msg.stop_reason === "refusal") {
      return "I can't help with that request. Try asking about people, consultants or your startup's needs.";
    }
    return msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }

  async complete({ system, prompt, maxTokens = 4000 }: { system: string; prompt: string; maxTokens?: number }) {
    const msg = await this.client.beta.messages.create({
      ...this.base(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    return this.textOf(msg);
  }

  async runWithTools({
    system,
    history,
    tools,
    execute,
    maxSteps = 6,
  }: Parameters<AIProvider["runWithTools"]>[0]) {
    const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
    const toolDefs: Anthropic.Beta.BetaTool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
    }));
    const trace: { tool: string; input: unknown }[] = [];

    for (let step = 0; step < maxSteps; step++) {
      const msg = await this.client.beta.messages.create({
        ...this.base(),
        max_tokens: 16000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: toolDefs,
        messages,
      });
      if (msg.stop_reason !== "tool_use") return { text: this.textOf(msg), trace };

      // Preserve the full assistant content (incl. thinking blocks) for the next turn.
      messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
      const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      const results = await Promise.all(
        uses.map(async (u): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
          trace.push({ tool: u.name, input: u.input });
          try {
            const out = await execute(u.name, u.input);
            return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) };
          } catch (err) {
            logger.warn("ai_tool_failed", { tool: u.name, err });
            return { type: "tool_result", tool_use_id: u.id, content: "Tool failed.", is_error: true };
          }
        }),
      );
      // All tool results go back in a single user message.
      messages.push({ role: "user", content: results });
    }
    return { text: "I ran out of steps before finishing. Try a more specific question.", trace };
  }
}

let cached: AIProvider | null | undefined;

/** Returns null when no provider is configured — callers must fall back to basic mode. */
export function getAIProvider(): AIProvider | null {
  if (cached !== undefined) return cached;
  cached = features.ai ? new AnthropicProvider() : null;
  return cached;
}
