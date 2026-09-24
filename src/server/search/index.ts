import { and, asc, desc, eq, ilike, inArray, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  industries,
  needs,
  openRoles,
  profiles,
  skills,
  startupIndustries,
  startupMembers,
  startups,
  userIndustries,
  userRoles,
  userSkills,
} from "../db/schema";
import { getPersonSummaries, type PersonSummary } from "../people";
import { discoverableProfile, getBlockedIds } from "../privacy/visibility";
import {
  AVAILABILITY,
  COMMITMENTS,
  NEED_TYPES,
  SKILL_CATEGORIES,
  STARTUP_STAGES,
  type NeedType,
  type StartupStage,
} from "@/lib/domain";
import {
  SEARCH_TABS,
  decodeCursor,
  encodeCursor,
  extractSearchTerms,
  type ExtractedTerms,
  type SearchTab,
  type VocabIndustry,
  type VocabSkill,
} from "./terms";

export { semanticIndex, type SemanticIndex } from "./semantic";
export { extractSearchTerms } from "./terms";

export { SEARCH_TABS, type SearchTab };
export const MAX_SEARCH_LIMIT = 24;

const csv = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(60)).max(20));

export const peopleFiltersSchema = z.object({
  skills: csv.optional(),
  /** Skill categories (engineering, ai_ml, …). Used by Discover chips and gap suggestions. */
  skillCategories: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(",")).filter(Boolean))
    .pipe(z.array(z.enum(SKILL_CATEGORIES)).max(11))
    .optional(),
  industries: csv.optional(),
  commitment: z.enum(COMMITMENTS).optional(),
  availability: z.enum(AVAILABILITY).optional(),
  location: z.string().trim().max(80).optional(),
  stage: z.enum(STARTUP_STAGES).optional(),
});
export type PeopleFilters = z.infer<typeof peopleFiltersSchema>;

export const searchPeopleSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  tab: z.enum(SEARCH_TABS).optional().default("people"),
  filters: peopleFiltersSchema.optional().default({}),
  cursor: z.string().max(100).nullish(),
  limit: z.coerce.number().int().min(1).max(MAX_SEARCH_LIMIT).optional().default(12),
});
export type SearchPeopleInput = z.input<typeof searchPeopleSchema>;

export type PersonSearchResult = {
  person: PersonSummary;
  /** Query terms this person matched (skills, industries, university) — shown as the "why". */
  matched: string[];
};

export type SearchPage<T> = { items: T[]; nextCursor: string | null; terms?: ExtractedTerms };

/* ───────────────────────── vocabulary (cached) ───────────────────────── */

type Vocab = { skills: VocabSkill[]; industries: VocabIndustry[]; universities: string[] };
let vocabCache: { at: number; value: Vocab } | null = null;
const VOCAB_TTL_MS = 5 * 60_000;

/** Skills, industries and universities used for term extraction. Reference data only — no personal fields. */
export async function getSearchVocabulary(): Promise<Vocab> {
  if (vocabCache && Date.now() - vocabCache.at < VOCAB_TTL_MS) return vocabCache.value;
  const [skillRows, industryRows, uniRows] = await Promise.all([
    db.select({ id: skills.id, slug: skills.slug, name: skills.name, category: skills.category }).from(skills),
    db.select({ id: industries.id, slug: industries.slug, name: industries.name }).from(industries),
    db
      .selectDistinct({ u: profiles.university })
      .from(profiles)
      .where(and(discoverableProfile(), sql`${profiles.university} is not null`))
      .limit(2000),
  ]);
  const value = { skills: skillRows, industries: industryRows, universities: uniRows.map((r) => r.u!).filter(Boolean) };
  vocabCache = { at: Date.now(), value };
  return value;
}

/* ───────────────────────── people ───────────────────────── */

/**
 * Must match `profiles_search_idx` exactly so Postgres can use the GIN index.
 * (see src/server/db/schema/people.ts)
 */
const profileTsv = sql`to_tsvector('english', coalesce(${profiles.displayName},'') || ' ' || coalesce(${profiles.headline},'') || ' ' || coalesce(${profiles.bio},'') || ' ' || coalesce(${profiles.university},'') || ' ' || coalesce(${profiles.currentRole},'') || ' ' || coalesce(${profiles.currentCompany},'') || ' ' || coalesce(${profiles.lookingFor},''))`;

/** Must match `startups_search_idx` exactly. */
const startupTsv = sql`to_tsvector('english', coalesce(${startups.name},'') || ' ' || coalesce(${startups.tagline},'') || ' ' || coalesce(${startups.description},'') || ' ' || coalesce(${startups.problem},'') || ' ' || coalesce(${startups.solution},''))`;

/** plainto_tsquery with its ANDs turned into ORs — partial matches count, ts_rank orders them. */
export function anyTermsQuery(text: string): SQL {
  return sql`replace(plainto_tsquery('english', ${text})::text, '&', '|')::tsquery`;
}

function hasSkillSlugs(slugs: string[]) {
  return sql`exists (select 1 from ${userSkills} inner join ${skills} on ${skills.id} = ${userSkills.skillId} where ${userSkills.userId} = ${profiles.userId} and ${inArray(skills.slug, slugs)})`;
}
function hasSkillCategories(cats: string[]) {
  return sql`exists (select 1 from ${userSkills} inner join ${skills} on ${skills.id} = ${userSkills.skillId} where ${userSkills.userId} = ${profiles.userId} and ${inArray(skills.category, cats)})`;
}
function hasIndustrySlugs(slugs: string[]) {
  return sql`exists (select 1 from ${userIndustries} inner join ${industries} on ${industries.id} = ${userIndustries.industryId} where ${userIndustries.userId} = ${profiles.userId} and ${inArray(industries.slug, slugs)})`;
}

function tabCondition(tab: SearchTab): SQL | undefined {
  switch (tab) {
    case "people":
      return undefined;
    case "cofounders":
      return eq(profiles.lookingForCofounder, true);
    case "founders":
      return or(
        sql`exists (select 1 from ${userRoles} where ${userRoles.userId} = ${profiles.userId} and ${userRoles.role} = 'founder')`,
        sql`exists (select 1 from ${startupMembers} where ${startupMembers.userId} = ${profiles.userId} and ${startupMembers.removedAt} is null and ${startupMembers.role} in ('founder','cofounder'))`,
      );
    case "talent":
      return or(
        sql`exists (select 1 from ${userRoles} where ${userRoles.userId} = ${profiles.userId} and ${userRoles.role} in ('talent','freelancer'))`,
        sql`'join' = any(${profiles.intents})`,
      );
  }
}

/** Escape LIKE wildcards in user input. */
function likeTerm(s: string) {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type SearchPeopleOptions = {
  /** Ids to leave out (e.g. existing team members when suggesting people for a gap). */
  excludeIds?: string[];
  /** Industry slugs that raise rank without being required. */
  boostIndustries?: string[];
};

/**
 * Keyword people search. Always: discoverable profiles only, never the viewer, never
 * anyone blocked in either direction. Offset-cursor pagination, at most 24 per page.
 */
export async function searchPeople(
  viewerId: string,
  rawInput: SearchPeopleInput,
  opts: SearchPeopleOptions = {},
): Promise<SearchPage<PersonSearchResult>> {
  const input = searchPeopleSchema.parse(rawInput);
  const { q, tab, filters, limit } = input;
  const offset = decodeCursor(input.cursor);
  const blocked = [...(await getBlockedIds(viewerId))];
  const exclude = [...blocked, ...(opts.excludeIds ?? [])];

  const vocab = q ? await getSearchVocabulary() : null;
  const terms = q && vocab ? extractSearchTerms(q, vocab) : null;

  const conditions: (SQL | undefined)[] = [
    discoverableProfile(),
    ne(profiles.userId, viewerId),
    exclude.length ? notInArray(profiles.userId, exclude) : undefined,
    tabCondition(tab),
    filters.skills?.length ? hasSkillSlugs(filters.skills) : undefined,
    filters.skillCategories?.length ? hasSkillCategories(filters.skillCategories) : undefined,
    filters.industries?.length ? hasIndustrySlugs(filters.industries) : undefined,
    filters.commitment ? eq(profiles.commitment, filters.commitment) : undefined,
    filters.availability ? eq(profiles.availability, filters.availability) : undefined,
    filters.location
      ? or(ilike(profiles.location, likeTerm(filters.location)), ilike(profiles.city, likeTerm(filters.location)), ilike(profiles.country, likeTerm(filters.location)))
      : undefined,
    filters.stage ? sql`${filters.stage} = any(${profiles.stagePreferences})` : undefined,
  ];

  const scoreParts: SQL[] = [];
  if (terms) {
    const match: SQL[] = [];
    if (terms.text) {
      const anyQ = anyTermsQuery(terms.text);
      match.push(sql`${profileTsv} @@ ${anyQ}`);
      scoreParts.push(sql`ts_rank(${profileTsv}, ${anyQ})`);
      scoreParts.push(sql`(case when ${profileTsv} @@ websearch_to_tsquery('english', ${q}) then 0.3 else 0 end)`);
    }
    if (terms.skillIds.length) {
      match.push(sql`exists (select 1 from ${userSkills} where ${userSkills.userId} = ${profiles.userId} and ${inArray(userSkills.skillId, terms.skillIds)})`);
      scoreParts.push(
        sql`0.35 * (select count(*) from ${userSkills} where ${userSkills.userId} = ${profiles.userId} and ${inArray(userSkills.skillId, terms.skillIds)})`,
      );
    }
    if (terms.categories.length) {
      match.push(hasSkillCategories(terms.categories));
      scoreParts.push(
        sql`0.2 * (select count(distinct ${skills.category}) from ${userSkills} inner join ${skills} on ${skills.id} = ${userSkills.skillId} where ${userSkills.userId} = ${profiles.userId} and ${inArray(skills.category, terms.categories)})`,
      );
    }
    if (terms.industryIds.length) {
      match.push(sql`exists (select 1 from ${userIndustries} where ${userIndustries.userId} = ${profiles.userId} and ${inArray(userIndustries.industryId, terms.industryIds)})`);
      scoreParts.push(
        sql`0.25 * (select count(*) from ${userIndustries} where ${userIndustries.userId} = ${profiles.userId} and ${inArray(userIndustries.industryId, terms.industryIds)})`,
      );
    }
    if (terms.universities.length) {
      match.push(inArray(profiles.university, terms.universities));
      scoreParts.push(sql`(case when ${inArray(profiles.university, terms.universities)} then 0.4 else 0 end)`);
    }
    // A query with no usable signal matches nobody rather than everybody.
    conditions.push(match.length ? or(...match) : sql`false`);
  }
  if (filters.skillCategories?.length) {
    // Depth in the requested categories: someone with three engineering skills beats someone with one.
    scoreParts.push(
      sql`0.15 * (select count(*) from ${userSkills} inner join ${skills} on ${skills.id} = ${userSkills.skillId} where ${userSkills.userId} = ${profiles.userId} and ${inArray(skills.category, filters.skillCategories)})`,
    );
  }
  if (opts.boostIndustries?.length) {
    scoreParts.push(sql`(case when ${hasIndustrySlugs(opts.boostIndustries)} then 0.3 else 0 end)`);
  }
  scoreParts.push(sql`(case when ${profiles.featured} then 0.05 else 0 end)`);
  const score = sql<number>`(${sql.join(scoreParts, sql` + `)})`;

  const rows = await db
    .select({ id: profiles.userId, score })
    .from(profiles)
    .where(and(...conditions))
    .orderBy(desc(score), desc(profiles.lastActiveAt), asc(profiles.userId))
    .limit(limit + 1)
    .offset(offset);

  const pageRows = rows.slice(0, limit);
  const summaries = await getPersonSummaries(pageRows.map((r) => r.id));
  const items = summaries.map((person) => ({ person, matched: terms ? matchedTerms(person, terms) : [] }));
  return { items, nextCursor: rows.length > limit ? encodeCursor(offset + limit) : null, terms: terms ?? undefined };
}

function matchedTerms(p: PersonSummary, t: ExtractedTerms): string[] {
  const out: string[] = [];
  const skillSet = new Set(t.skillNames.map((s) => s.toLowerCase()));
  for (const s of p.skills) if (skillSet.has(s.toLowerCase())) out.push(s);
  const indSet = new Set(t.industryNames.map((s) => s.toLowerCase()));
  for (const i of p.industries) if (indSet.has(i.toLowerCase())) out.push(i);
  if (p.university && t.universities.includes(p.university)) out.push(p.university);
  return out;
}

/* ───────────────────────── startups ───────────────────────── */

export const searchStartupsSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  stage: z.enum(STARTUP_STAGES).optional(),
  /** Industry slug. */
  industry: z.string().max(60).optional(),
  /** Open need type the startup is looking for (cofounder, consultant, …). */
  lookingFor: z.enum(NEED_TYPES).optional(),
  cursor: z.string().max(100).nullish(),
  limit: z.coerce.number().int().min(1).max(MAX_SEARCH_LIMIT).optional().default(12),
});
export type SearchStartupsInput = z.input<typeof searchStartupsSchema>;

export type StartupSummary = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  tagline: string | null;
  stage: StartupStage;
  location: string | null;
  industries: string[];
  /** Titles of open needs and open roles — what the team is looking for right now. */
  lookingFor: { type: NeedType | "role"; title: string }[];
  isDemo: boolean;
};

/** Public, non-deleted startups only. Startups created by someone the viewer blocked are hidden. */
export async function searchStartups(viewerId: string, rawInput: SearchStartupsInput): Promise<SearchPage<StartupSummary>> {
  const input = searchStartupsSchema.parse(rawInput);
  const { q, stage, industry, lookingFor, limit } = input;
  const offset = decodeCursor(input.cursor);
  const blocked = [...(await getBlockedIds(viewerId))];

  const conditions: (SQL | undefined)[] = [
    eq(startups.visibility, "public"),
    isNull(startups.deletedAt),
    blocked.length ? or(isNull(startups.createdById), notInArray(startups.createdById, blocked)) : undefined,
    stage ? eq(startups.stage, stage) : undefined,
    industry
      ? sql`exists (select 1 from ${startupIndustries} inner join ${industries} on ${industries.id} = ${startupIndustries.industryId} where ${startupIndustries.startupId} = ${startups.id} and ${industries.slug} = ${industry})`
      : undefined,
    lookingFor
      ? sql`exists (select 1 from ${needs} where ${needs.startupId} = ${startups.id} and ${needs.status} = 'open' and ${needs.type} = ${lookingFor})`
      : undefined,
  ];

  const scoreParts: SQL[] = [sql`0::float8`];
  if (q) {
    const vocab = await getSearchVocabulary();
    const terms = extractSearchTerms(q, vocab);
    const match: SQL[] = [];
    if (terms.text) {
      const anyQ = anyTermsQuery(terms.text);
      match.push(sql`${startupTsv} @@ ${anyQ}`);
      scoreParts.push(sql`ts_rank(${startupTsv}, ${anyQ})`);
      scoreParts.push(sql`(case when ${startupTsv} @@ websearch_to_tsquery('english', ${q}) then 0.3 else 0 end)`);
    }
    if (terms.industryIds.length) {
      const hasInd = sql`exists (select 1 from ${startupIndustries} where ${startupIndustries.startupId} = ${startups.id} and ${inArray(startupIndustries.industryId, terms.industryIds)})`;
      match.push(hasInd);
      scoreParts.push(sql`(case when ${hasInd} then 0.3 else 0 end)`);
    }
    if (terms.skillIds.length) {
      // Startups whose open needs ask for a mentioned skill.
      const needsSkill = sql`exists (select 1 from needs n inner join need_skills ns on ns.need_id = n.id where n.startup_id = ${startups.id} and n.status = 'open' and ${inArray(sql`ns.skill_id`, terms.skillIds)})`;
      match.push(needsSkill);
      scoreParts.push(sql`(case when ${needsSkill} then 0.25 else 0 end)`);
    }
    conditions.push(match.length ? or(...match) : sql`false`);
  }
  const score = sql<number>`(${sql.join(scoreParts, sql` + `)})`;

  const rows = await db
    .select({ id: startups.id, score })
    .from(startups)
    .where(and(...conditions))
    .orderBy(desc(score), desc(startups.updatedAt), asc(startups.id))
    .limit(limit + 1)
    .offset(offset);
  const items = await getStartupSummaries(rows.slice(0, limit).map((r) => r.id));
  return { items, nextCursor: rows.length > limit ? encodeCursor(offset + limit) : null };
}

/** Batch-build startup cards. Callers must have applied visibility filtering. */
export async function getStartupSummaries(ids: string[]): Promise<StartupSummary[]> {
  if (!ids.length) return [];
  const [rows, indRows, needRows, roleRows] = await Promise.all([
    db.select().from(startups).where(inArray(startups.id, ids)),
    db
      .select({ startupId: startupIndustries.startupId, name: industries.name })
      .from(startupIndustries)
      .innerJoin(industries, eq(industries.id, startupIndustries.industryId))
      .where(inArray(startupIndustries.startupId, ids)),
    db
      .select({ startupId: needs.startupId, type: needs.type, title: needs.title })
      .from(needs)
      .where(and(inArray(needs.startupId, ids), eq(needs.status, "open")))
      .orderBy(asc(needs.createdAt)),
    db
      .select({ startupId: openRoles.startupId, title: openRoles.title })
      .from(openRoles)
      .where(and(inArray(openRoles.startupId, ids), eq(openRoles.isOpen, true))),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      logoUrl: s.logoUrl,
      tagline: s.tagline,
      stage: s.stage,
      location: s.location,
      industries: indRows.filter((i) => i.startupId === s.id).map((i) => i.name),
      lookingFor: [
        ...needRows.filter((n) => n.startupId === s.id).map((n) => ({ type: n.type, title: n.title })),
        ...roleRows.filter((r) => r.startupId === s.id).map((r) => ({ type: "role" as const, title: r.title })),
      ].slice(0, 4),
      isDemo: s.isDemo,
    }));
}

/** Industries for filter chips (reference data). */
export async function listIndustries() {
  return (await getSearchVocabulary()).industries;
}
