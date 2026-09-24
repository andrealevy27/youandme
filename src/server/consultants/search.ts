import { and, asc, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  consultantCategories,
  consultantProfileCategories,
  consultantProfiles,
  consultantServices,
  industries,
  profiles,
  userIndustries,
} from "../db/schema";
import { getBlockedIds } from "../privacy/visibility";
import { enforceRateLimit } from "../rate-limit";
import { track } from "../analytics";
import { STARTUP_STAGES, STAGE_LABELS, type StartupStage } from "@/lib/domain";
import { consultantsWithOpenSlots } from "./availability";
import { getConsultantCards, listableConsultant, type ConsultantCard } from "./cards";
import { interpretNeed } from "./need";
import type { InterpretedNeed } from "./need-rules";

export const SEARCH_SORTS = ["relevance", "rating", "price_low", "price_high"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];
export const MAX_PAGE_SIZE = 24;

const boolParam = z
  .union([z.boolean(), z.enum(["1", "true", "0", "false", ""])])
  .optional()
  .transform((v) => v === true || v === "1" || v === "true");

export const consultantSearchInput = z.object({
  q: z.string().trim().max(200).optional().transform((v) => v || undefined),
  need: z.string().trim().max(2000).optional().transform((v) => v || undefined),
  category: z.string().trim().max(80).optional().transform((v) => v || undefined),
  industry: z.string().trim().max(80).optional().transform((v) => v || undefined),
  maxPrice: z.coerce.number().int().positive().max(10_000_000).optional().catch(undefined),
  minRating: z.coerce.number().min(1).max(5).optional().catch(undefined),
  stage: z.enum(STARTUP_STAGES).optional().catch(undefined),
  language: z.string().trim().max(40).optional().transform((v) => v || undefined),
  remote: boolParam,
  availableThisWeek: boolParam,
  sort: z.enum(SEARCH_SORTS).default("relevance").catch("relevance"),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(12).catch(12),
});
export type ConsultantSearchInput = z.input<typeof consultantSearchInput>;
export type ConsultantSearchFilters = z.output<typeof consultantSearchInput>;

export type ConsultantResult = ConsultantCard & { why: string[] };

export type ConsultantSearchResult = {
  results: ConsultantResult[];
  page: number;
  limit: number;
  hasMore: boolean;
  interpreted: (InterpretedNeed & { source: "ai" | "rules"; categoryNames: string[] }) | null;
};

const tsvector = sql`to_tsvector('english', coalesce(${consultantProfiles.headline},'') || ' ' || coalesce(${consultantProfiles.bio},''))`;

/** Sanitised OR-query over lexemes: only [a-z0-9] tokens ever reach to_tsquery. */
function orTsQuery(words: string[]): SQL | null {
  const clean = [...new Set(words.flatMap((w) => w.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length >= 2))].slice(0, 12);
  if (!clean.length) return null;
  return sql`to_tsquery('english', ${clean.join(" | ")})`;
}

const minActivePrice = sql<number | null>`(select min(${consultantServices.priceCents}) from ${consultantServices}
  where ${consultantServices.consultantId} = ${consultantProfiles.userId} and ${consultantServices.active} and ${consultantServices.deletedAt} is null)`;

/**
 * Marketplace search. Filters are applied in SQL; relevance uses full-text rank
 * (matching the GIN index expression) plus category matches when a need is described.
 */
export async function searchConsultants(viewerId: string, raw: ConsultantSearchInput): Promise<ConsultantSearchResult> {
  const f = consultantSearchInput.parse(raw);
  enforceRateLimit("search", viewerId);

  let interpreted: ConsultantSearchResult["interpreted"] = null;
  if (f.need) {
    const need = await interpretNeed(f.need);
    const names = need.categorySlugs.length
      ? (await db.select({ slug: consultantCategories.slug, name: consultantCategories.name }).from(consultantCategories).where(inArray(consultantCategories.slug, need.categorySlugs)))
      : [];
    interpreted = { ...need, categoryNames: need.categorySlugs.map((s) => names.find((n) => n.slug === s)?.name ?? s) };
  }

  const blocked = [...(await getBlockedIds(viewerId))];
  const conds: (SQL | undefined)[] = [listableConsultant(), eq(consultantProfiles.acceptingClients, true)];
  if (blocked.length) conds.push(notInArray(consultantProfiles.userId, blocked));
  if (f.category) {
    conds.push(sql`exists (select 1 from ${consultantProfileCategories} cpc join ${consultantCategories} cc on cc.id = cpc.category_id
      where cpc.consultant_id = ${consultantProfiles.userId} and cc.slug = ${f.category})`);
  }
  if (f.industry) {
    conds.push(sql`exists (select 1 from ${userIndustries} ui join ${industries} i on i.id = ui.industry_id
      where ui.user_id = ${consultantProfiles.userId} and i.slug = ${f.industry})`);
  }
  if (f.maxPrice) {
    conds.push(sql`exists (select 1 from ${consultantServices} s where s.consultant_id = ${consultantProfiles.userId}
      and s.active and s.deleted_at is null and s.price_cents <= ${f.maxPrice})`);
  }
  if (f.minRating) conds.push(and(sql`${consultantProfiles.reviewCount} > 0`, sql`${consultantProfiles.ratingAvg} >= ${f.minRating}`));
  if (f.stage) conds.push(sql`${f.stage} = any(${consultantProfiles.stagesServed})`);
  if (f.language) conds.push(sql`exists (select 1 from unnest(${consultantProfiles.languages}) l where lower(l) = lower(${f.language}))`);
  if (f.remote) conds.push(eq(consultantProfiles.remoteAvailable, true));

  let textRank: SQL = sql`0`;
  if (f.q) {
    const query = sql`websearch_to_tsquery('english', ${f.q})`;
    conds.push(sql`(${tsvector} @@ ${query}
      or ${profiles.displayName} ilike ${"%" + f.q.replace(/[%_]/g, "") + "%"}
      or exists (select 1 from ${consultantServices} s where s.consultant_id = ${consultantProfiles.userId} and s.active and s.deleted_at is null
        and to_tsvector('english', s.title || ' ' || s.description) @@ ${query}))`);
    textRank = sql`ts_rank(${tsvector}, ${query})`;
  }

  let needScore: SQL = sql`0`;
  if (interpreted) {
    const orQuery = orTsQuery(interpreted.keywords);
    const catScore = interpreted.categorySlugs.length
      ? sql`(select count(*) from ${consultantProfileCategories} cpc join ${consultantCategories} cc on cc.id = cpc.category_id
          where cpc.consultant_id = ${consultantProfiles.userId} and cc.slug in ${interpreted.categorySlugs})`
      : sql`0`;
    const kwScore = orQuery ? sql`ts_rank(${tsvector}, ${orQuery})` : sql`0`;
    const budget = interpreted.maxBudgetCents
      ? sql`case when ${minActivePrice} <= ${interpreted.maxBudgetCents} then 0.5 else 0 end`
      : sql`0`;
    const stage = interpreted.stage ? sql`case when ${interpreted.stage} = any(${consultantProfiles.stagesServed}) then 0.5 else 0 end` : sql`0`;
    needScore = sql`(${catScore} * 3 + ${kwScore} * 10 + ${budget} + ${stage})`;
    // A described need must actually match something — never pad results with unrelated people.
    const matchConds: SQL[] = [sql`${catScore} > 0`];
    if (orQuery) matchConds.push(sql`${tsvector} @@ ${orQuery}`);
    conds.push(sql`(${sql.join(matchConds, sql` or `)})`);
  }

  if (f.availableThisWeek) {
    const candidates = await db
      .select({ id: consultantProfiles.userId })
      .from(consultantProfiles)
      .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
      .where(and(...conds))
      .limit(500);
    const open = await consultantsWithOpenSlots(candidates.map((c) => c.id), 7);
    if (!open.size) return { results: [], page: f.page, limit: f.limit, hasMore: false, interpreted };
    conds.push(inArray(consultantProfiles.userId, [...open]));
  }

  const relevance = sql`(${needScore} + ${textRank} * 5 + case when ${consultantProfiles.featured} then 0.3 else 0 end
    + coalesce(${consultantProfiles.ratingAvg}, 0) * 0.05 + least(${consultantProfiles.reviewCount}, 20) * 0.01)`;
  const orderBy: SQL[] =
    f.sort === "rating"
      ? [sql`${consultantProfiles.ratingAvg} desc nulls last`, desc(consultantProfiles.reviewCount)]
      : f.sort === "price_low"
        ? [sql`${minActivePrice} asc nulls last`]
        : f.sort === "price_high"
          ? [sql`${minActivePrice} desc nulls last`]
          : [sql`${relevance} desc`];
  orderBy.push(asc(consultantProfiles.userId));

  const offset = (f.page - 1) * f.limit;
  const rows = await db
    .select({ id: consultantProfiles.userId })
    .from(consultantProfiles)
    .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
    .where(and(...conds))
    .orderBy(...orderBy)
    .limit(f.limit + 1)
    .offset(offset);

  const hasMore = rows.length > f.limit;
  const ids = rows.slice(0, f.limit).map((r) => r.id);
  const cards = await getConsultantCards(ids);
  const results = cards.map((c) => ({ ...c, why: interpreted ? explainMatch(c, interpreted) : [] }));

  track("consultant_search", viewerId, {
    hasNeed: !!f.need,
    hasQuery: !!f.q,
    category: f.category ?? null,
    sort: f.sort,
    results: results.length,
    aiInterpreted: interpreted?.source === "ai",
  });
  return { results, page: f.page, limit: f.limit, hasMore, interpreted };
}

/**
 * Honest "why this consultant" chips — built only from the consultant's real
 * categories, services, stages and industries. Never invented.
 */
export function explainMatch(c: ConsultantCard, need: Pick<InterpretedNeed, "categorySlugs" | "maxBudgetCents" | "stage" | "keywords">): string[] {
  const why: string[] = [];
  const matchedCats = c.categories.filter((cat) => need.categorySlugs.includes(cat.slug));
  if (matchedCats.length) why.push(`Offers ${matchedCats.map((m) => m.name).join(" & ")}`);
  if (need.maxBudgetCents) {
    const within = c.services.filter((s) => s.priceCents <= need.maxBudgetCents!).sort((a, b) => a.priceCents - b.priceCents)[0];
    if (within) why.push(`“${within.title}” fits your budget`);
  }
  if (need.stage && c.stagesServed.includes(need.stage)) why.push(`Works with ${STAGE_LABELS[need.stage as StartupStage]}-stage startups`);
  const kw = new Set(need.keywords.map((k) => k.toLowerCase()));
  const matchedService = c.services.find(
    (s) => (s.categorySlug && need.categorySlugs.includes(s.categorySlug)) || s.title.toLowerCase().split(/\W+/).some((w) => kw.has(w)),
  );
  if (matchedService && !why.some((w) => w.includes(matchedService.title))) why.push(`Service: ${matchedService.title}`);
  const text = `${c.headline} ${c.bio ?? ""}`.toLowerCase();
  const mentioned = [...kw].filter((k) => k.length >= 3 && new RegExp(`\\b${k.replace(/[^a-z0-9]/g, "")}\\b`).test(text)).slice(0, 2);
  if (mentioned.length && why.length < 4) why.push(`Mentions ${mentioned.join(", ")} in their profile`);
  return why.slice(0, 4);
}
