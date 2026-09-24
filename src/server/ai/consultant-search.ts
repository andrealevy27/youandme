import { and, asc, eq, inArray, isNull, ne, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  consultantCategories,
  consultantProfileCategories,
  consultantProfiles,
  consultantServices,
  profiles,
} from "../db/schema";
import { discoverableProfile, getBlockedIds } from "../privacy/visibility";
import { anyTermsQuery } from "../search";
import { extractSearchTerms } from "../search/terms";
import type { PricingType } from "@/lib/domain";
import { matchConsultantCategories } from "./intent";

/**
 * Minimal consultant lookup for the AI concierge. Deliberately independent of
 * `server/consultants` (the marketplace service) so the two can evolve separately.
 *
 * Visibility: approved consultant profiles only, whose person profile is discoverable
 * (active, not deleted, public, onboarded), never the viewer, never blocked either way.
 * Only active, non-deleted services are priced.
 */

export type ConsultantResult = {
  userId: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  headline: string;
  categories: string[];
  yearsExperience: number | null;
  ratingAvg: number | null;
  reviewCount: number;
  acceptingClients: boolean;
  fromPriceCents: number | null;
  fromPricingType: PricingType | null;
  currency: string;
  services: { title: string; priceCents: number; pricingType: PricingType; currency: string }[];
  isDemo: boolean;
};

/** Must match `consultant_profiles_search_idx` exactly. */
const consultantTsv = sql`to_tsvector('english', coalesce(${consultantProfiles.headline},'') || ' ' || coalesce(${consultantProfiles.bio},''))`;

type CategoryRow = { id: string; slug: string; name: string; keywords: string[] };
let categoryCache: { at: number; rows: CategoryRow[] } | null = null;

async function activeCategories(): Promise<CategoryRow[]> {
  if (categoryCache && Date.now() - categoryCache.at < 5 * 60_000) return categoryCache.rows;
  const rows = await db
    .select({ id: consultantCategories.id, slug: consultantCategories.slug, name: consultantCategories.name, keywords: consultantCategories.keywords })
    .from(consultantCategories)
    .where(eq(consultantCategories.active, true))
    .orderBy(asc(consultantCategories.sortOrder));
  categoryCache = { at: Date.now(), rows };
  return rows;
}

export async function searchConsultantsForAI(
  viewerId: string,
  input: { query: string; maxBudgetCents?: number; category?: string; limit?: number },
): Promise<ConsultantResult[]> {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
  const blocked = [...(await getBlockedIds(viewerId))];
  const cats = await activeCategories();

  const explicit = input.category
    ? cats.filter((c) => c.slug === input.category!.toLowerCase() || c.name.toLowerCase() === input.category!.toLowerCase())
    : [];
  const inferred = input.query ? matchConsultantCategories(input.query, cats) : [];
  const categoryIds = [...new Set(inferred.map((c) => c.id))];

  const activeService = and(eq(consultantServices.consultantId, consultantProfiles.userId), eq(consultantServices.active, true), isNull(consultantServices.deletedAt));
  const inCategories = (ids: string[]) =>
    sql`exists (select 1 from ${consultantProfileCategories} where ${consultantProfileCategories.consultantId} = ${consultantProfiles.userId} and ${inArray(consultantProfileCategories.categoryId, ids)})`;

  const conditions: (SQL | undefined)[] = [
    eq(consultantProfiles.status, "approved"),
    discoverableProfile(),
    ne(consultantProfiles.userId, viewerId),
    blocked.length ? notInArray(consultantProfiles.userId, blocked) : undefined,
    explicit.length ? inCategories(explicit.map((c) => c.id)) : undefined,
    input.maxBudgetCents
      ? sql`exists (select 1 from ${consultantServices} where ${activeService} and ${consultantServices.priceCents} <= ${input.maxBudgetCents})`
      : undefined,
  ];

  const scoreParts: SQL[] = [sql`0::float8`];
  const terms = input.query ? extractSearchTerms(input.query, { skills: [], industries: [] }).text : "";
  const match: SQL[] = [];
  if (terms) {
    const anyQ = anyTermsQuery(terms);
    const serviceText = sql`exists (select 1 from ${consultantServices} where ${activeService} and to_tsvector('english', ${consultantServices.title} || ' ' || ${consultantServices.description}) @@ ${anyQ})`;
    match.push(sql`${consultantTsv} @@ ${anyQ}`, serviceText);
    scoreParts.push(sql`ts_rank(${consultantTsv}, ${anyQ})`, sql`(case when ${serviceText} then 0.2 else 0 end)`);
  }
  if (categoryIds.length) {
    match.push(inCategories(categoryIds));
    scoreParts.push(sql`(case when ${inCategories(categoryIds)} then 0.5 else 0 end)`);
  }
  // Without an explicit category, a query must match something; with one, the category is enough.
  if (!explicit.length && input.query && match.length) conditions.push(sql`(${sql.join(match, sql` or `)})`);
  if (!explicit.length && input.query && !match.length) conditions.push(sql`false`);
  scoreParts.push(sql`(case when ${consultantProfiles.acceptingClients} then 0.1 else 0 end)`);
  const score = sql<number>`(${sql.join(scoreParts, sql` + `)})`;

  const rows = await db
    .select({
      userId: consultantProfiles.userId,
      handle: profiles.handle,
      name: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      isDemo: profiles.isDemo,
      headline: consultantProfiles.headline,
      yearsExperience: consultantProfiles.yearsExperience,
      ratingAvg: consultantProfiles.ratingAvg,
      reviewCount: consultantProfiles.reviewCount,
      acceptingClients: consultantProfiles.acceptingClients,
      currency: consultantProfiles.currency,
      score,
    })
    .from(consultantProfiles)
    .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
    .where(and(...conditions))
    .orderBy(sql`${score} desc`, sql`${consultantProfiles.ratingAvg} desc nulls last`, sql`${consultantProfiles.reviewCount} desc`, asc(consultantProfiles.userId))
    .limit(limit);
  if (!rows.length) return [];

  const ids = rows.map((r) => r.userId);
  const [catRows, serviceRows] = await Promise.all([
    db
      .select({ consultantId: consultantProfileCategories.consultantId, name: consultantCategories.name })
      .from(consultantProfileCategories)
      .innerJoin(consultantCategories, eq(consultantCategories.id, consultantProfileCategories.categoryId))
      .where(inArray(consultantProfileCategories.consultantId, ids)),
    db
      .select({
        consultantId: consultantServices.consultantId,
        title: consultantServices.title,
        priceCents: consultantServices.priceCents,
        pricingType: consultantServices.pricingType,
        currency: consultantServices.currency,
      })
      .from(consultantServices)
      .where(and(inArray(consultantServices.consultantId, ids), eq(consultantServices.active, true), isNull(consultantServices.deletedAt)))
      .orderBy(asc(consultantServices.priceCents)),
  ]);

  return rows.map((r) => {
    const services = serviceRows.filter((s) => s.consultantId === r.userId);
    const affordable = input.maxBudgetCents ? services.filter((s) => s.priceCents <= input.maxBudgetCents!) : services;
    const from = services[0] ?? null;
    return {
      userId: r.userId,
      handle: r.handle,
      name: r.name,
      avatarUrl: r.avatarUrl,
      headline: r.headline,
      categories: catRows.filter((c) => c.consultantId === r.userId).map((c) => c.name),
      yearsExperience: r.yearsExperience,
      ratingAvg: r.reviewCount > 0 ? r.ratingAvg : null,
      reviewCount: r.reviewCount,
      acceptingClients: r.acceptingClients,
      fromPriceCents: from?.priceCents ?? null,
      fromPricingType: from?.pricingType ?? null,
      currency: from?.currency ?? r.currency,
      services: (affordable.length ? affordable : services).slice(0, 3).map(({ title, priceCents, pricingType, currency }) => ({ title, priceCents, pricingType, currency })),
      isDemo: r.isDemo,
    };
  });
}
