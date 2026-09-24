import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  consultantCategories,
  industries,
  needSkills,
  needs,
  profiles,
  skills,
  startupIndustries,
  startupMembers,
  startups,
  userSkills,
} from "../db/schema";
import { forbidden } from "../errors";
import type { PersonSummary } from "../people";
import { searchPeople } from "../search";
import type { SkillCategory, StartupMemberRole, StartupStage } from "@/lib/domain";
import {
  CONSULTANT_CATEGORIES_FOR_GAP,
  computeCapabilityGaps,
  summarizeGaps,
  type CapabilityResult,
  type ModelGap,
} from "./gaps-model";

export type { GapSeverity } from "./gaps-model";

export type TeamGap = ModelGap & {
  /** Discoverable people (never team members, never blocked) who list this capability. */
  suggestedPeople: PersonSummary[];
  /** Consultant marketplace categories to consider; link as /consultants?category=<slug>. */
  consultantCategories: { slug: string; name: string }[];
};

export type TeamGapAnalysis = {
  status: "ok" | "no_startup";
  startup: { id: string; slug: string; name: string; stage: StartupStage } | null;
  team: { userId: string; name: string; handle: string; role: StartupMemberRole; title: string | null; categories: SkillCategory[] }[];
  covered: CapabilityResult["covered"];
  gaps: TeamGap[];
  summary: string;
};

const SUGGESTIONS_PER_GAP = 3;
const MAX_GAPS_WITH_SUGGESTIONS = 5;

/** The viewer's primary startup: founder roles first, then most recently joined. */
async function resolveStartupId(viewerId: string, startupId?: string): Promise<string | null> {
  const rows = await db
    .select({ id: startups.id, role: startupMembers.role, joinedAt: startupMembers.joinedAt })
    .from(startupMembers)
    .innerJoin(startups, eq(startups.id, startupMembers.startupId))
    .where(
      and(
        eq(startupMembers.userId, viewerId),
        isNull(startupMembers.removedAt),
        isNull(startups.deletedAt),
        startupId ? eq(startups.id, startupId) : undefined,
      ),
    )
    .orderBy(sql`case ${startupMembers.role} when 'founder' then 0 when 'cofounder' then 1 else 2 end`, desc(startupMembers.joinedAt));
  if (startupId && !rows.length) throw forbidden("Only members of this startup can see its team analysis.");
  return rows[0]?.id ?? null;
}

/**
 * Deterministic founding-team gap analysis for one of the viewer's startups.
 * Only members may analyse a startup (private team data). Suggested people come from
 * the same visibility-filtered search as Discover.
 */
export async function analyzeTeamGaps(viewerId: string, startupId?: string): Promise<TeamGapAnalysis> {
  const id = await resolveStartupId(viewerId, startupId);
  if (!id) {
    return {
      status: "no_startup",
      startup: null,
      team: [],
      covered: [],
      gaps: [],
      summary: "Add your startup to see which capabilities your founding team is missing.",
    };
  }

  const [startupRows, industryRows, memberRows, needRows] = await Promise.all([
    db.select().from(startups).where(eq(startups.id, id)).limit(1),
    db
      .select({ slug: industries.slug, name: industries.name })
      .from(startupIndustries)
      .innerJoin(industries, eq(industries.id, startupIndustries.industryId))
      .where(eq(startupIndustries.startupId, id)),
    db
      .select({
        userId: startupMembers.userId,
        role: startupMembers.role,
        title: startupMembers.title,
        name: profiles.displayName,
        handle: profiles.handle,
      })
      .from(startupMembers)
      .innerJoin(profiles, eq(profiles.userId, startupMembers.userId))
      .where(and(eq(startupMembers.startupId, id), isNull(startupMembers.removedAt), isNull(profiles.deletedAt)))
      .orderBy(asc(startupMembers.joinedAt)),
    db
      .select({ id: needs.id, title: needs.title, category: skills.category })
      .from(needs)
      .leftJoin(needSkills, eq(needSkills.needId, needs.id))
      .leftJoin(skills, eq(skills.id, needSkills.skillId))
      .where(and(eq(needs.startupId, id), eq(needs.status, "open"))),
  ]);
  const startup = startupRows[0]!;
  const memberIds = memberRows.map((m) => m.userId);
  const skillRows = memberIds.length
    ? await db
        .select({ userId: userSkills.userId, slug: skills.slug, category: skills.category })
        .from(userSkills)
        .innerJoin(skills, eq(skills.id, userSkills.skillId))
        .where(inArray(userSkills.userId, memberIds))
    : [];

  const needsById = new Map<string, { title: string; categories: SkillCategory[] }>();
  for (const n of needRows) {
    const entry = needsById.get(n.id) ?? needsById.set(n.id, { title: n.title, categories: [] }).get(n.id)!;
    if (n.category) entry.categories.push(n.category as SkillCategory);
  }

  const team = memberRows.map((m) => {
    const s = skillRows.filter((r) => r.userId === m.userId).map((r) => ({ slug: r.slug, category: r.category as SkillCategory }));
    return { ...m, skills: s, categories: [...new Set(s.map((x) => x.category))] };
  });

  const result = computeCapabilityGaps({
    startup: {
      name: startup.name,
      industries: industryRows.map((i) => i.slug),
      businessModel: startup.businessModel,
      stage: startup.stage,
      fundingStatus: startup.fundingStatus,
      openNeeds: [...needsById.values()],
    },
    team: team.map((m) => ({ name: m.name, skills: m.skills })),
  });

  const wantedSlugs = [...new Set(result.gaps.flatMap((g) => CONSULTANT_CATEGORIES_FOR_GAP[g.category]))];
  const categoryRows = wantedSlugs.length
    ? await db
        .select({ slug: consultantCategories.slug, name: consultantCategories.name })
        .from(consultantCategories)
        .where(and(inArray(consultantCategories.slug, wantedSlugs), eq(consultantCategories.active, true)))
    : [];

  const industrySlugs = industryRows.map((i) => i.slug);
  const gaps: TeamGap[] = await Promise.all(
    result.gaps.map(async (g, idx) => {
      let suggestedPeople: PersonSummary[] = [];
      if (idx < MAX_GAPS_WITH_SUGGESTIONS) {
        const page = await searchPeople(
          viewerId,
          {
            tab: "people",
            limit: SUGGESTIONS_PER_GAP,
            filters: g.skillSlugs.length ? { skills: g.skillSlugs } : { skillCategories: [g.category] },
          },
          { excludeIds: memberIds, boostIndustries: industrySlugs },
        );
        suggestedPeople = page.items.map((i) => i.person);
      }
      return {
        ...g,
        suggestedPeople,
        consultantCategories: CONSULTANT_CATEGORIES_FOR_GAP[g.category]
          .map((slug) => categoryRows.find((c) => c.slug === slug))
          .filter((c): c is { slug: string; name: string } => !!c),
      };
    }),
  );

  return {
    status: "ok",
    startup: { id: startup.id, slug: startup.slug, name: startup.name, stage: startup.stage },
    team: team.map(({ userId, name, handle, role, title, categories }) => ({ userId, name, handle, role, title, categories })),
    covered: result.covered,
    gaps,
    summary: summarizeGaps(startup.name, result.gaps),
  };
}
