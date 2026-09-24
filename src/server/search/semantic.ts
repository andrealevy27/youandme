/**
 * Future vector-search seam.
 *
 * Today search is keyword-based (Postgres full-text + skill/industry/university term
 * boosts, see `./index.ts`). When we add pgvector, an implementation of `SemanticIndex`
 * plugs in here and its scores are blended into the keyword ranking — callers
 * (Discover, the API and the AI concierge tools) do not change.
 *
 * What to embed (one vector per entity, re-embedded on update):
 *  - person:     profiles.bio + headline + looking_for + goals, skill names, industry names
 *  - startup:    startups.description + problem + solution + tagline, open needs (title + description)
 *  - consultant: consultant_profiles.headline + bio (expertise), service titles + descriptions
 *  - interests:  user_industries / startup_industries names (as a short "interests" sentence)
 *  - needs:      needs.title + description (so "what I need" can be matched to people who offer it)
 *
 * Privacy: only embed fields that are already public on the entity's card/profile.
 * Never embed email, phone, private startup fields (pitch deck, funding amounts) or
 * message content. The index must be filtered by the same visibility rules as keyword
 * search (`discoverableProfile()`, blocks, startup visibility) AFTER the vector lookup.
 */
export type SemanticEntity = "person" | "startup" | "consultant" | "need";

export interface SemanticIndex {
  readonly name: string;
  /** Whether the index can answer queries (false for the no-op implementation). */
  readonly enabled: boolean;
  /** Returns entity ids with similarity in [0,1], best first. */
  query(entity: SemanticEntity, text: string, opts?: { limit?: number }): Promise<{ id: string; similarity: number }[]>;
  /** (Re)index one entity from its public text. */
  upsert(entity: SemanticEntity, id: string, text: string): Promise<void>;
  remove(entity: SemanticEntity, id: string): Promise<void>;
}

/** Default: no vector search. Keyword search carries all ranking. */
export const noopSemanticIndex: SemanticIndex = {
  name: "noop",
  enabled: false,
  async query() {
    return [];
  },
  async upsert() {},
  async remove() {},
};

export const semanticIndex: SemanticIndex = noopSemanticIndex;
