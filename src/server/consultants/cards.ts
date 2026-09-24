import { and, asc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import {
  consultantCategories,
  consultantProfileCategories,
  consultantProfiles,
  consultantServices,
  industries,
  profiles,
  userIndustries,
} from "../db/schema";
import type { PricingType } from "@/lib/domain";

/** Public, sanitised consultant representation used by cards, search results, the API and AI tools. */
export type ConsultantCard = {
  userId: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  isDemo: boolean;
  headline: string;
  bio: string | null;
  location: string | null;
  categories: { slug: string; name: string }[];
  fromPrice: { cents: number; currency: string; pricingType: PricingType; billingInterval: string | null } | null;
  ratingAvg: number | null;
  reviewCount: number;
  languages: string[];
  remoteAvailable: boolean;
  acceptingClients: boolean;
  stagesServed: string[];
  industries: string[];
  previousCompanies: string[];
  yearsExperience: number | null;
  featured: boolean;
  services: { id: string; title: string; pricingType: PricingType; priceCents: number; currency: string; billingInterval: string | null; categorySlug: string | null }[];
};

/** SQL condition: consultant is listable (approved, active, not deleted, not hidden). */
export function listableConsultant(): SQL {
  return and(
    eq(consultantProfiles.status, "approved"),
    eq(profiles.status, "active"),
    isNull(profiles.deletedAt),
    ne(profiles.visibility, "hidden"),
  )!;
}

/** Batch-load cards (fixed query count), preserving the order of `ids`. */
export async function getConsultantCards(ids: string[], conn: DbOrTx = db): Promise<ConsultantCard[]> {
  if (!ids.length) return [];
  const [rows, catRows, serviceRows, industryRows] = await Promise.all([
    conn
      .select({ c: consultantProfiles, p: profiles })
      .from(consultantProfiles)
      .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
      .where(inArray(consultantProfiles.userId, ids)),
    conn
      .select({ consultantId: consultantProfileCategories.consultantId, slug: consultantCategories.slug, name: consultantCategories.name, sortOrder: consultantCategories.sortOrder })
      .from(consultantProfileCategories)
      .innerJoin(consultantCategories, eq(consultantCategories.id, consultantProfileCategories.categoryId))
      .where(and(inArray(consultantProfileCategories.consultantId, ids), eq(consultantCategories.active, true)))
      .orderBy(asc(consultantCategories.sortOrder)),
    conn
      .select({
        id: consultantServices.id,
        consultantId: consultantServices.consultantId,
        title: consultantServices.title,
        pricingType: consultantServices.pricingType,
        priceCents: consultantServices.priceCents,
        currency: consultantServices.currency,
        billingInterval: consultantServices.billingInterval,
        categorySlug: consultantCategories.slug,
      })
      .from(consultantServices)
      .leftJoin(consultantCategories, eq(consultantCategories.id, consultantServices.categoryId))
      .where(and(inArray(consultantServices.consultantId, ids), eq(consultantServices.active, true), isNull(consultantServices.deletedAt)))
      .orderBy(asc(consultantServices.sortOrder), asc(consultantServices.priceCents)),
    conn
      .select({ userId: userIndustries.userId, name: industries.name })
      .from(userIndustries)
      .innerJoin(industries, eq(industries.id, userIndustries.industryId))
      .where(inArray(userIndustries.userId, ids)),
  ]);
  const byId = new Map(rows.map((r) => [r.c.userId, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(({ c, p }) => {
      const services = serviceRows.filter((s) => s.consultantId === c.userId);
      const cheapest = [...services].sort((a, b) => a.priceCents - b.priceCents)[0];
      const fromPrice = cheapest
        ? { cents: cheapest.priceCents, currency: cheapest.currency, pricingType: cheapest.pricingType, billingInterval: cheapest.billingInterval }
        : c.hourlyRateCents
          ? { cents: c.hourlyRateCents, currency: c.currency, pricingType: "hourly" as const, billingInterval: null }
          : null;
      return {
        userId: c.userId,
        handle: p.handle,
        name: p.displayName,
        avatarUrl: p.avatarUrl,
        isDemo: p.isDemo,
        headline: c.headline,
        bio: c.bio,
        location: p.location ?? ([p.city, p.country].filter(Boolean).join(", ") || null),
        categories: catRows.filter((r) => r.consultantId === c.userId).map(({ slug, name }) => ({ slug, name })),
        fromPrice,
        ratingAvg: c.reviewCount > 0 ? c.ratingAvg : null,
        reviewCount: c.reviewCount,
        languages: c.languages,
        remoteAvailable: c.remoteAvailable,
        acceptingClients: c.acceptingClients,
        stagesServed: c.stagesServed,
        industries: industryRows.filter((r) => r.userId === c.userId).map((r) => r.name),
        previousCompanies: c.previousCompanies,
        yearsExperience: c.yearsExperience,
        featured: c.featured,
        services: services.map(({ consultantId: _c, ...s }) => s),
      };
    });
}

export async function listActiveCategories(conn: DbOrTx = db) {
  return conn
    .select({ id: consultantCategories.id, slug: consultantCategories.slug, name: consultantCategories.name, description: consultantCategories.description, keywords: consultantCategories.keywords })
    .from(consultantCategories)
    .where(eq(consultantCategories.active, true))
    .orderBy(asc(consultantCategories.sortOrder), asc(consultantCategories.name));
}

export async function listIndustries(conn: DbOrTx = db) {
  return conn.select({ slug: industries.slug, name: industries.name }).from(industries).orderBy(asc(industries.name));
}

/** Languages that approved consultants actually offer (for the filter UI). */
export async function listConsultantLanguages(conn: DbOrTx = db): Promise<string[]> {
  const rows = await conn.execute<{ l: string }>(sql`
    select distinct unnest(${consultantProfiles.languages}) as l from ${consultantProfiles}
    where ${consultantProfiles.status} = 'approved' order by 1`);
  return rows.map((r) => r.l);
}
