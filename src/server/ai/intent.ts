import type { SearchTab } from "../search/terms";

/**
 * Basic-mode intent router (pure). When no AI provider is configured, the concierge
 * maps a message to the SAME controlled tools the model would call, then answers from
 * their results with a template. No generated text, no invented people.
 */

export type ConciergeAction =
  | { tool: "searchPeople"; query: string; tab: SearchTab }
  | { tool: "searchConsultants"; query: string; maxBudgetCents?: number }
  | { tool: "analyzeTeamGaps" }
  | { tool: "getMatches" }
  | { tool: "getUserNeeds" };

export type IntentKind = "matches" | "gaps" | "hire" | "consultant" | "cofounder" | "people" | "needs" | "general";

export type RoutedIntent = { kind: IntentKind; actions: ConciergeAction[]; maxBudgetCents?: number };

const has = (text: string, re: RegExp) => re.test(text);

/** "$500", "under 500 dollars", "2k", "$1,500" → cents. Only when a money cue is present. */
export function parseBudgetCents(message: string): number | undefined {
  const m = message.toLowerCase();
  const money =
    m.match(/\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b/) ??
    m.match(/\b(?:under|below|less than|max(?:imum)?|budget(?: of| is)?|up to)\s+\$?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b/) ??
    m.match(/\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\s*(?:dollars|usd)\b/);
  if (!money) return undefined;
  const n = Number(money[1]!.replace(/,/g, "")) * (money[2] ? 1000 : 1);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return undefined;
  return Math.round(n * 100);
}

/** Strip conversational scaffolding so the search sees the topic ("TikTok growth"). */
export function topicOf(message: string): string {
  return message
    .replace(/\b(under|below|less than|up to|max(imum)?|budget( of| is)?)\s+\$?\s?\d[\d,.]*\s*k?\b/gi, " ")
    .replace(/\$\s?\d[\d,.]*\s*k?/gi, " ")
    .replace(
      /\b(i need|i'm looking for|i am looking for|we need|we're looking for|looking for|find me|find|can you|could you|please|someone who can|someone to|someone who|someone|somebody|who can|a consultant for|consultant for|a consultant|consultants?|help with|help me with|help me|help|me|a|an|the|our|my|who understands|understands|that|for)\b/gi,
      " ",
    )
    .replace(/[?.!,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function routeIntent(message: string): RoutedIntent {
  const m = message.toLowerCase();
  const budget = parseBudgetCents(message);
  const topic = topicOf(message);

  if (has(m, /\b(hire next|who should (i|we) hire|what should (i|we) hire|first hire|next hire)\b/)) {
    return { kind: "hire", actions: [{ tool: "analyzeTeamGaps" }] };
  }
  if (has(m, /\b(gaps?|missing|weak(ness|nesses)?|blind spots?)\b/) || has(m, /\bwhat (does|do) (my|our) (founding )?team (need|lack)\b/)) {
    return { kind: "gaps", actions: [{ tool: "analyzeTeamGaps" }] };
  }
  if (has(m, /\b(my|our) matches\b|\bwho (have i|did i) match|\bmatched with\b|\bshow (me )?(my )?matches\b|\btoday'?s (matches|recommendations)\b/)) {
    return { kind: "matches", actions: [{ tool: "getMatches" }] };
  }
  if (has(m, /\b(my|our) needs\b|\bwhat do (i|we) need\b/)) {
    return { kind: "needs", actions: [{ tool: "getUserNeeds" }] };
  }
  const wantsCofounder = has(m, /\bco-?founders?\b/);
  const explicitConsultant = has(m, /\b(consultants?|freelancers?|agency|agencies|contractor)\b/) || budget !== undefined;
  if (explicitConsultant && !wantsCofounder) {
    return { kind: "consultant", maxBudgetCents: budget, actions: [{ tool: "searchConsultants", query: topic, maxBudgetCents: budget }] };
  }
  if (wantsCofounder) {
    return { kind: "cofounder", actions: [{ tool: "searchPeople", query: topic, tab: "cofounders" }] };
  }
  if (has(m, /\bhelp (with|me)\b|\badvice on\b|\badvisor\b/)) {
    // Help can come from a paid expert or from someone in the network — show both.
    return {
      kind: "consultant",
      actions: [
        { tool: "searchConsultants", query: topic },
        { tool: "searchPeople", query: topic, tab: "people" },
      ],
    };
  }
  if (has(m, /\b(design|redesign|ux|ui|onboarding|brand|landing page)\b/)) {
    return {
      kind: "people",
      actions: [
        { tool: "searchPeople", query: topic, tab: "people" },
        { tool: "searchConsultants", query: topic },
      ],
    };
  }
  if (has(m, /\b(engineer|developer|technical|designer|marketer|founders?|someone|people|person|talent|who)\b/)) {
    const tab: SearchTab = has(m, /\bfounders?\b/) ? "founders" : has(m, /\b(talent|join|hire)\b/) ? "talent" : "people";
    return { kind: "people", actions: [{ tool: "searchPeople", query: topic, tab }] };
  }
  return {
    kind: "general",
    actions: [
      { tool: "searchPeople", query: topic || message, tab: "people" },
      { tool: "searchConsultants", query: topic || message },
    ],
  };
}

/** Consultant categories whose name/slug/keywords appear in the query (pure). */
export function matchConsultantCategories<T extends { slug: string; name: string; keywords: string[] }>(query: string, categories: T[]): T[] {
  const q = ` ${query.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const hit = (phrase: string) => {
    const p = phrase.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return p.length > 1 && q.includes(` ${p} `);
  };
  return categories.filter((c) => hit(c.name) || hit(c.slug) || c.keywords.some(hit));
}
