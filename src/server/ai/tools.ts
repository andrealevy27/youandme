import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  industries,
  matches,
  needs,
  openRoles,
  profiles,
  skills,
  startupIndustries,
  startupMembers,
  startups,
  userSkills,
} from "../db/schema";
import { getPersonSummaries, type PersonSummary } from "../people";
import { canViewProfile } from "../privacy/visibility";
import { getDailyRecommendations } from "../recommendations";
import { getSearchVocabulary, searchPeople as searchPeopleService } from "../search";
import { SEARCH_TABS } from "../search/terms";
import {
  AVAILABILITY_LABELS,
  BUSINESS_MODEL_LABELS,
  COMMITMENTS,
  COMMITMENT_LABELS,
  FUNDING_STATUS_LABELS,
  NEED_TYPE_LABELS,
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  STAGE_LABELS,
  STARTUP_MEMBER_ROLE_LABELS,
  USER_ROLE_LABELS,
  VERIFICATION_LABELS,
  type SkillCategory,
  type UserRole,
  type VerificationType,
} from "@/lib/domain";
import { searchConsultantsForAI, type ConsultantResult } from "./consultant-search";
import { analyzeTeamGaps as analyzeTeamGapsService, type TeamGapAnalysis } from "./gaps";
import type { AIToolDefinition } from "./provider";

/**
 * Controlled tools for You&Me AI. The concierge (model or basic mode) can ONLY reach data
 * through these functions. Every tool:
 *  - runs as the viewer (viewerId is bound at construction, never taken from model input),
 *  - applies the same visibility rules as the product UI (discoverable, not blocked,
 *    not deleted/suspended, startup membership for private startup data),
 *  - returns sanitised public fields only — NEVER email, phone, auth data, private
 *    startup data of startups the viewer isn't a member of, or message content.
 *
 * Every person/consultant/startup a tool returns is recorded, so result cards shown in
 * the UI can only ever be entities a tool actually returned.
 */

/* ───────────── sanitised shapes (exactly what the model sees) ───────────── */

/**
 * PublicPerson — exposes: name, handle, headline, current role/company, location,
 * university, skills, industries, platform roles, cofounder-seeking flag, commitment,
 * availability, verification labels. Never: email, phone, links, bio, activity, ids.
 */
export type PublicPerson = {
  name: string;
  handle: string;
  headline: string | null;
  currently: string | null;
  location: string | null;
  university: string | null;
  roles: string[];
  skills: string[];
  industries: string[];
  lookingForCofounder: boolean;
  commitment: string | null;
  availability: string | null;
  verified: string[];
  matchedOn?: string[];
};

/**
 * PublicConsultant — exposes: name, handle, headline, categories, experience, rating
 * (only when reviews exist), from-price and up to 3 services. Never: payout/Stripe data,
 * calendar data, email.
 */
export type PublicConsultant = {
  name: string;
  handle: string;
  headline: string;
  categories: string[];
  yearsExperience: number | null;
  rating: string | null;
  fromPrice: string | null;
  acceptingClients: boolean;
  services: { title: string; price: string }[];
};

export type CollectedEntity = { kind: "person" | "consultant" | "startup"; id: string; name: string };

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

const PRICE_SUFFIX: Record<string, string> = { hourly: "/hr", recurring: "/mo", fixed: "", package: "" };

export function toPublicPerson(p: PersonSummary, matchedOn?: string[]): PublicPerson {
  return {
    name: p.name,
    handle: p.handle,
    headline: p.headline,
    currently: [p.currentRole, p.currentCompany].filter(Boolean).join(" at ") || null,
    location: p.location,
    university: p.university,
    roles: p.roles.map((r) => USER_ROLE_LABELS[r as UserRole] ?? r),
    skills: p.skills.slice(0, 8),
    industries: p.industries,
    lookingForCofounder: p.lookingForCofounder,
    commitment: p.commitment ? COMMITMENT_LABELS[p.commitment] : null,
    availability: p.availability ? AVAILABILITY_LABELS[p.availability] : null,
    verified: p.verified.map((v) => VERIFICATION_LABELS[v as VerificationType] ?? v),
    ...(matchedOn?.length ? { matchedOn } : {}),
  };
}

export function toPublicConsultant(c: ConsultantResult): PublicConsultant {
  return {
    name: c.name,
    handle: c.handle,
    headline: c.headline,
    categories: c.categories,
    yearsExperience: c.yearsExperience,
    rating: c.ratingAvg != null && c.reviewCount > 0 ? `${c.ratingAvg.toFixed(1)} from ${c.reviewCount} review${c.reviewCount === 1 ? "" : "s"}` : null,
    fromPrice: c.fromPriceCents != null ? `${money(c.fromPriceCents, c.currency)}${PRICE_SUFFIX[c.fromPricingType ?? "fixed"] ?? ""}` : null,
    acceptingClients: c.acceptingClients,
    services: c.services.map((s) => ({ title: s.title, price: `${money(s.priceCents, s.currency)}${PRICE_SUFFIX[s.pricingType] ?? ""}` })),
  };
}

/* ───────────── input schemas ───────────── */

const searchPeopleInput = z.object({
  query: z.string().max(300).default(""),
  tab: z.enum(SEARCH_TABS).optional(),
  skillCategories: z.array(z.enum(SKILL_CATEGORIES)).max(6).optional(),
  industries: z.array(z.string().max(60)).max(6).optional(),
  commitment: z.enum(COMMITMENTS).optional(),
  location: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(8).optional(),
});

const searchConsultantsInput = z.object({
  query: z.string().max(300).default(""),
  maxBudgetCents: z.number().int().positive().max(100_000_000).optional(),
  category: z.string().max(60).optional(),
});

const startupRefInput = z.object({ startup: z.string().max(120).optional() });

/* ───────────── tool definitions (what the model is told) ───────────── */

export const CONCIERGE_TOOL_DEFINITIONS: AIToolDefinition[] = [
  {
    name: "searchPeople",
    description:
      "Search discoverable members of the You&Me network (cofounder candidates, founders, talent, advisors). Keyword search over headline, role, company, university and 'looking for', boosted by skill, industry and university terms in the query. Returns public profile fields only. Use tab 'cofounders' for people actively looking for a cofounder, 'founders' for people building a startup, 'talent' for people who want to join a startup.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language keywords, e.g. 'computer vision engineer healthcare NYU'." },
        tab: { type: "string", enum: [...SEARCH_TABS] },
        skillCategories: { type: "array", items: { type: "string", enum: [...SKILL_CATEGORIES] }, description: "Hard filter: person must have a skill in one of these categories." },
        industries: { type: "array", items: { type: "string" }, description: "Hard filter by industry name, e.g. 'Health', 'Fintech'." },
        commitment: { type: "string", enum: [...COMMITMENTS] },
        location: { type: "string", description: "City or country substring." },
        limit: { type: "integer", minimum: 1, maximum: 8 },
      },
      required: ["query"],
    },
  },
  {
    name: "searchConsultants",
    description:
      "Search approved consultants in the You&Me marketplace. Returns headline, categories, rating (only if reviewed), from-price and a few services. maxBudgetCents keeps only consultants with at least one service at or under that price (USD cents; $500 = 50000).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the founder needs help with, e.g. 'TikTok growth'." },
        maxBudgetCents: { type: "integer" },
        category: { type: "string", description: "Consultant category slug or name, e.g. 'fundraising', 'ux-ui', 'growth'." },
      },
      required: ["query"],
    },
  },
  {
    name: "getStartupContext",
    description:
      "The viewer's own startups: stage, business model, industries, description, open needs, open roles and team (names, roles, skill categories). Call this first when the question depends on what the viewer is building.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getUserNeeds",
    description: "The viewer's open needs (and their startups' open needs): what kind of help they said they are looking for.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getMatches",
    description: "The viewer's mutual cofounder matches and today's curated cofounder recommendations (with the deterministic reason each was suggested).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getStartupTeam",
    description: "Team members of one of the viewer's startups (only works for startups the viewer is a member of).",
    inputSchema: {
      type: "object",
      properties: { startup: { type: "string", description: "Startup slug from getStartupContext." } },
      required: ["startup"],
    },
  },
  {
    name: "analyzeTeamGaps",
    description:
      "Deterministic founding-team gap analysis for the viewer's startup: which capabilities its market, business model and stage need that no team member lists, with severity, an explicit reason, suggested people and consultant categories for each gap. Use for 'what are my gaps', 'who should I hire next'.",
    inputSchema: {
      type: "object",
      properties: { startup: { type: "string", description: "Optional startup slug; defaults to the viewer's primary startup." } },
    },
  },
];

/* ───────────── the tool session ───────────── */

export class ConciergeTools {
  /** Every entity any tool returned during this run, in first-seen order. */
  readonly collected = new Map<string, CollectedEntity>();
  /** Entities returned by the most recent search-like tool call (fallback cards). */
  lastResults: CollectedEntity[] = [];
  readonly trace: { tool: string; input: unknown }[] = [];

  constructor(readonly viewerId: string) {}

  private record(entities: CollectedEntity[], asLast = true) {
    for (const e of entities) {
      const key = `${e.kind}:${e.id}`;
      if (!this.collected.has(key)) this.collected.set(key, e);
    }
    if (asLast && entities.length) this.lastResults = entities;
  }

  /** Dispatcher used by the model loop. Validates input; unknown tools are rejected. */
  execute = async (name: string, rawInput: unknown): Promise<unknown> => {
    this.trace.push({ tool: name, input: rawInput });
    const input = (rawInput ?? {}) as Record<string, unknown>;
    switch (name) {
      case "searchPeople": {
        const i = searchPeopleInput.parse(input);
        return { people: await this.searchPeople(i.query, i) };
      }
      case "searchConsultants": {
        const i = searchConsultantsInput.parse(input);
        return { consultants: await this.searchConsultants(i.query, i.maxBudgetCents, i.category) };
      }
      case "getStartupContext":
        return this.getStartupContext();
      case "getUserNeeds":
        return this.getUserNeeds();
      case "getMatches":
        return this.getMatches();
      case "getStartupTeam": {
        const i = startupRefInput.parse(input);
        return this.getStartupTeam(i.startup ?? "");
      }
      case "analyzeTeamGaps": {
        const i = startupRefInput.parse(input);
        return this.publicGaps(await this.analyzeTeamGaps(i.startup));
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };

  async searchPeople(query: string, filters: Omit<z.infer<typeof searchPeopleInput>, "query"> = {}): Promise<PublicPerson[]> {
    let industrySlugs: string[] | undefined;
    if (filters.industries?.length) {
      const vocab = await getSearchVocabulary();
      const wanted = filters.industries.map((s) => s.toLowerCase());
      industrySlugs = vocab.industries.filter((i) => wanted.includes(i.name.toLowerCase()) || wanted.includes(i.slug)).map((i) => i.slug);
    }
    const page = await searchPeopleService(this.viewerId, {
      q: query,
      tab: filters.tab ?? "people",
      limit: filters.limit ?? 5,
      filters: {
        skillCategories: filters.skillCategories,
        industries: industrySlugs?.length ? industrySlugs : undefined,
        commitment: filters.commitment,
        location: filters.location,
      },
    });
    this.record(page.items.map((i) => ({ kind: "person", id: i.person.userId, name: i.person.name })));
    return page.items.map((i) => toPublicPerson(i.person, i.matched));
  }

  async searchConsultants(query: string, maxBudgetCents?: number, category?: string): Promise<PublicConsultant[]> {
    const rows = await searchConsultantsForAI(this.viewerId, { query, maxBudgetCents, category, limit: 5 });
    this.record(rows.map((r) => ({ kind: "consultant", id: r.userId, name: r.name })));
    return rows.map(toPublicConsultant);
  }

  /** Viewer's memberships (not removed, startup not deleted). */
  private async memberships() {
    return db
      .select({ startup: startups, role: startupMembers.role, title: startupMembers.title })
      .from(startupMembers)
      .innerJoin(startups, eq(startups.id, startupMembers.startupId))
      .where(and(eq(startupMembers.userId, this.viewerId), isNull(startupMembers.removedAt), isNull(startups.deletedAt)))
      .orderBy(desc(startupMembers.joinedAt));
  }

  private async teamFor(startupIds: string[]) {
    if (!startupIds.length) return [];
    const members = await db
      .select({
        startupId: startupMembers.startupId,
        userId: startupMembers.userId,
        role: startupMembers.role,
        title: startupMembers.title,
        name: profiles.displayName,
        handle: profiles.handle,
      })
      .from(startupMembers)
      .innerJoin(profiles, eq(profiles.userId, startupMembers.userId))
      .where(and(inArray(startupMembers.startupId, startupIds), isNull(startupMembers.removedAt), isNull(profiles.deletedAt), eq(profiles.status, "active")))
      .orderBy(asc(startupMembers.joinedAt));
    const ids = [...new Set(members.map((m) => m.userId))];
    const cats = ids.length
      ? await db
          .selectDistinct({ userId: userSkills.userId, category: skills.category })
          .from(userSkills)
          .innerJoin(skills, eq(skills.id, userSkills.skillId))
          .where(inArray(userSkills.userId, ids))
      : [];
    return members.map((m) => ({
      ...m,
      skillCategories: cats.filter((c) => c.userId === m.userId).map((c) => SKILL_CATEGORY_LABELS[c.category as SkillCategory] ?? c.category),
    }));
  }

  /**
   * Exposes (viewer's own startups only): name, slug, tagline, description, problem, solution,
   * stage, business model, industries, funding status, traction, open needs, open roles,
   * team names/roles/titles/skill categories. Never: pitch deck URL, funding amounts.
   */
  async getStartupContext() {
    const rows = await this.memberships();
    if (!rows.length) return { startups: [], note: "The viewer has not added a startup yet." };
    const ids = rows.map((r) => r.startup.id);
    const [indRows, needRows, roleRows, team] = await Promise.all([
      db
        .select({ startupId: startupIndustries.startupId, name: industries.name })
        .from(startupIndustries)
        .innerJoin(industries, eq(industries.id, startupIndustries.industryId))
        .where(inArray(startupIndustries.startupId, ids)),
      db.select().from(needs).where(and(inArray(needs.startupId, ids), eq(needs.status, "open"))),
      db.select().from(openRoles).where(and(inArray(openRoles.startupId, ids), eq(openRoles.isOpen, true))),
      this.teamFor(ids),
    ]);
    this.record(rows.map((r) => ({ kind: "startup", id: r.startup.id, name: r.startup.name })), false);
    return {
      startups: rows.map(({ startup: s, role, title }) => ({
        name: s.name,
        slug: s.slug,
        viewerRole: STARTUP_MEMBER_ROLE_LABELS[role],
        viewerTitle: title,
        tagline: s.tagline,
        description: s.description,
        problem: s.problem,
        solution: s.solution,
        stage: STAGE_LABELS[s.stage],
        businessModel: s.businessModel ? (BUSINESS_MODEL_LABELS[s.businessModel as keyof typeof BUSINESS_MODEL_LABELS] ?? s.businessModel) : null,
        industries: indRows.filter((i) => i.startupId === s.id).map((i) => i.name),
        fundingStatus: s.fundingStatus ? FUNDING_STATUS_LABELS[s.fundingStatus] : null,
        traction: s.traction,
        location: s.location,
        openNeeds: needRows
          .filter((n) => n.startupId === s.id)
          .map((n) => ({ type: NEED_TYPE_LABELS[n.type], title: n.title, description: n.description })),
        openRoles: roleRows.filter((r) => r.startupId === s.id).map((r) => ({ title: r.title, type: r.type })),
        team: team
          .filter((m) => m.startupId === s.id)
          .map((m) => ({ name: m.name, role: STARTUP_MEMBER_ROLE_LABELS[m.role], title: m.title, skillCategories: m.skillCategories })),
      })),
    };
  }

  /** Exposes: type, title, description, commitment, budget, startup name — for the viewer's own needs only. */
  async getUserNeeds() {
    const mine = await this.memberships();
    const startupIds = mine.map((m) => m.startup.id);
    const rows = await db
      .select({ need: needs, startupName: startups.name })
      .from(needs)
      .leftJoin(startups, eq(startups.id, needs.startupId))
      .where(
        and(
          eq(needs.status, "open"),
          startupIds.length ? or(eq(needs.ownerId, this.viewerId), inArray(needs.startupId, startupIds)) : eq(needs.ownerId, this.viewerId),
        ),
      )
      .orderBy(desc(needs.createdAt))
      .limit(20);
    return {
      needs: rows.map(({ need: n, startupName }) => ({
        type: NEED_TYPE_LABELS[n.type],
        title: n.title,
        description: n.description,
        startup: startupName,
        commitment: n.commitment ? COMMITMENT_LABELS[n.commitment] : null,
        budgetMax: n.budgetMaxCents ? money(n.budgetMaxCents) : null,
      })),
    };
  }

  /** Mutual matches (visible profiles only) + today's recommendations with their stored reason. */
  async getMatches() {
    const rows = await db
      .select({ a: matches.userAId, b: matches.userBId })
      .from(matches)
      .where(and(or(eq(matches.userAId, this.viewerId), eq(matches.userBId, this.viewerId)), isNull(matches.unmatchedAt)))
      .orderBy(desc(matches.createdAt))
      .limit(10);
    const otherIds = rows.map((r) => (r.a === this.viewerId ? r.b : r.a));
    const visible: string[] = [];
    for (const id of otherIds) if (await canViewProfile(this.viewerId, id)) visible.push(id);
    const matchPeople = await getPersonSummaries(visible);

    const recs = await getDailyRecommendations(this.viewerId);
    const recPeople = await getPersonSummaries(recs.items.map((r) => r.person.userId));
    const recById = new Map(recPeople.map((p) => [p.userId, p]));

    const entities: CollectedEntity[] = [
      ...matchPeople.map((p) => ({ kind: "person" as const, id: p.userId, name: p.name })),
      ...recPeople.map((p) => ({ kind: "person" as const, id: p.userId, name: p.name })),
    ];
    this.record(entities);
    return {
      mutualMatches: matchPeople.map((p) => toPublicPerson(p)),
      todaysRecommendations: recs.items
        .filter((r) => recById.has(r.person.userId))
        .map((r) => ({
          person: toPublicPerson(recById.get(r.person.userId)!),
          compatibility: r.score,
          reason: r.reason,
          strengths: r.strengths.slice(0, 3).map((s) => s.detail),
        })),
    };
  }

  /** Team of a startup the viewer belongs to (by slug or id). Non-members get an error, never data. */
  async getStartupTeam(ref: string) {
    const mine = await this.memberships();
    const s = mine.find((m) => m.startup.slug.toLowerCase() === ref.toLowerCase() || m.startup.id === ref)?.startup;
    if (!s) return { error: "You can only see the team of a startup you are a member of." };
    const team = await this.teamFor([s.id]);
    return {
      startup: s.name,
      team: team.map((m) => ({ name: m.name, role: STARTUP_MEMBER_ROLE_LABELS[m.role], title: m.title, skillCategories: m.skillCategories })),
    };
  }

  async analyzeTeamGaps(ref?: string): Promise<TeamGapAnalysis> {
    let startupId: string | undefined;
    if (ref) {
      const mine = await this.memberships();
      startupId = mine.find((m) => m.startup.slug.toLowerCase() === ref.toLowerCase() || m.startup.id === ref)?.startup.id;
    }
    const analysis = await analyzeTeamGapsService(this.viewerId, startupId);
    this.record(analysis.gaps.flatMap((g) => g.suggestedPeople.map((p) => ({ kind: "person" as const, id: p.userId, name: p.name }))));
    return analysis;
  }

  /** Model-facing gap analysis: drops ids and keeps public person fields only. */
  publicGaps(a: TeamGapAnalysis) {
    return {
      startup: a.startup?.name ?? null,
      summary: a.summary,
      team: a.team.map((m) => ({ name: m.name, role: STARTUP_MEMBER_ROLE_LABELS[m.role], skillCategories: m.categories.map((c) => SKILL_CATEGORY_LABELS[c]) })),
      covered: a.covered.map((c) => c.label),
      gaps: a.gaps.map((g) => ({
        capability: g.label,
        severity: g.severity,
        reason: g.reason,
        suggestedPeople: g.suggestedPeople.map((p) => toPublicPerson(p)),
        consultantCategories: g.consultantCategories.map((c) => c.name),
      })),
    };
  }
}
