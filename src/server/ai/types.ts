import type { PricingType, StartupStage } from "@/lib/domain";

/**
 * Public DTOs returned by the concierge to the UI (web + API). Safe to `import type`
 * from client components. Cards are always hydrated from IDs that concierge tools
 * returned, and re-checked against visibility at read time.
 */
export type ConciergeCard =
  | {
      kind: "person";
      userId: string;
      handle: string;
      name: string;
      avatarUrl: string | null;
      headline: string | null;
      location: string | null;
      skills: string[];
      lookingForCofounder: boolean;
      isDemo: boolean;
    }
  | {
      kind: "consultant";
      userId: string;
      handle: string;
      name: string;
      avatarUrl: string | null;
      headline: string;
      categories: string[];
      fromPriceCents: number | null;
      fromPricingType: PricingType | null;
      currency: string;
      ratingAvg: number | null;
      reviewCount: number;
      isDemo: boolean;
    }
  | {
      kind: "startup";
      startupId: string;
      slug: string;
      name: string;
      logoUrl: string | null;
      tagline: string | null;
      stage: StartupStage;
      isDemo: boolean;
    };

export type ConciergeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards: ConciergeCard[];
  createdAt: string;
};

export type ConciergeThread = { id: string; title: string; updatedAt: string };

export type ConciergeReply = {
  threadId: string;
  mode: "ai" | "basic";
  userMessage: ConciergeMessage;
  message: ConciergeMessage;
};
