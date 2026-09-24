import { and, eq, inArray, isNull, ne, notInArray, or } from "drizzle-orm";
import { db } from "../db";
import {
  consultantCategories,
  consultantProfileCategories,
  consultantProfiles,
  industries,
  needs,
  profiles,
  startupIndustries,
  startupMembers,
  startups,
  userIndustries,
} from "../db/schema";
import { getBlockedIds } from "../privacy/visibility";
import { STAGE_LABELS, type StartupStage } from "@/lib/domain";
import { getConsultantCards, listableConsultant, type ConsultantCard } from "./cards";

export type RecommendedConsultant = { consultant: ConsultantCard; reason: string };

/**
 * Consultants worth a look for this user, driven by their (and their startups')
 * open consultant needs plus startup stage and industries. Reasons are built only
 * from real overlaps; if nothing overlaps, nothing is recommended.
 */
export async function getRecommendedConsultantsForUser(userId: string, limit = 3): Promise<RecommendedConsultant[]> {
  const memberships = await db
    .select({ id: startups.id, name: startups.name, stage: startups.stage })
    .from(startupMembers)
    .innerJoin(startups, eq(startups.id, startupMembers.startupId))
    .where(and(eq(startupMembers.userId, userId), isNull(startupMembers.removedAt), isNull(startups.deletedAt)));
  const startupIds = memberships.map((m) => m.id);

  const [openNeeds, startupIndustryRows, ownIndustryRows] = await Promise.all([
    db
      .select({ id: needs.id, title: needs.title, categoryId: needs.consultantCategoryId, budgetMaxCents: needs.budgetMaxCents, categoryName: consultantCategories.name })
      .from(needs)
      .leftJoin(consultantCategories, eq(consultantCategories.id, needs.consultantCategoryId))
      .where(
        and(
          eq(needs.type, "consultant"),
          eq(needs.status, "open"),
          startupIds.length ? or(eq(needs.ownerId, userId), inArray(needs.startupId, startupIds)) : eq(needs.ownerId, userId),
        ),
      ),
    startupIds.length
      ? db
          .select({ id: industries.id, name: industries.name })
          .from(startupIndustries)
          .innerJoin(industries, eq(industries.id, startupIndustries.industryId))
          .where(inArray(startupIndustries.startupId, startupIds))
      : Promise.resolve([] as { id: string; name: string }[]),
    db.select({ id: industries.id, name: industries.name }).from(userIndustries).innerJoin(industries, eq(industries.id, userIndustries.industryId)).where(eq(userIndustries.userId, userId)),
  ]);

  const categoryIds = [...new Set(openNeeds.map((n) => n.categoryId).filter((c): c is string => !!c))];
  const stages = [...new Set(memberships.map((m) => m.stage))];
  const industryIds = [...new Set([...startupIndustryRows, ...ownIndustryRows].map((i) => i.id))];
  if (!categoryIds.length && !stages.length && !industryIds.length) return [];

  const blocked = [...(await getBlockedIds(userId))];
  const candidates = await db
    .select({ id: consultantProfiles.userId })
    .from(consultantProfiles)
    .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
    .where(
      and(
        listableConsultant(),
        eq(consultantProfiles.acceptingClients, true),
        ne(consultantProfiles.userId, userId),
        blocked.length ? notInArray(consultantProfiles.userId, blocked) : undefined,
      ),
    )
    .limit(300);
  if (!candidates.length) return [];
  const ids = candidates.map((c) => c.id);

  const [catRows, indRows] = await Promise.all([
    categoryIds.length
      ? db
          .select({ consultantId: consultantProfileCategories.consultantId, categoryId: consultantProfileCategories.categoryId })
          .from(consultantProfileCategories)
          .where(and(inArray(consultantProfileCategories.consultantId, ids), inArray(consultantProfileCategories.categoryId, categoryIds)))
      : Promise.resolve([] as { consultantId: string; categoryId: string }[]),
    industryIds.length
      ? db
          .select({ userId: userIndustries.userId, name: industries.name })
          .from(userIndustries)
          .innerJoin(industries, eq(industries.id, userIndustries.industryId))
          .where(and(inArray(userIndustries.userId, ids), inArray(userIndustries.industryId, industryIds)))
      : Promise.resolve([] as { userId: string; name: string }[]),
  ]);
  const stageRows = await db
    .select({ id: consultantProfiles.userId, stagesServed: consultantProfiles.stagesServed, ratingAvg: consultantProfiles.ratingAvg, reviewCount: consultantProfiles.reviewCount })
    .from(consultantProfiles)
    .where(inArray(consultantProfiles.userId, ids));

  const scored = stageRows
    .map((c) => {
      const matchedNeeds = openNeeds.filter((n) => n.categoryId && catRows.some((r) => r.consultantId === c.id && r.categoryId === n.categoryId));
      const matchedStages = stages.filter((s) => c.stagesServed.includes(s));
      const matchedIndustries = [...new Set(indRows.filter((r) => r.userId === c.id).map((r) => r.name))];
      const score =
        matchedNeeds.length * 10 + (matchedNeeds.length ? matchedStages.length * 2 : matchedStages.length) + matchedIndustries.length * 1.5 + (c.reviewCount ? (c.ratingAvg ?? 0) * 0.1 : 0);
      return { id: c.id, score, matchedNeeds, matchedStages, matchedIndustries };
    })
    // Stage alone is too weak a signal to call something a recommendation.
    .filter((c) => c.matchedNeeds.length > 0 || (c.matchedIndustries.length > 0 && c.matchedStages.length > 0))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(limit, 12)));

  const cards = await getConsultantCards(scored.map((s) => s.id));
  return scored
    .map((s) => {
      const card = cards.find((c) => c.userId === s.id);
      if (!card) return null;
      const parts: string[] = [];
      const need = s.matchedNeeds[0];
      if (need) parts.push(`Matches your open need “${need.title}”${need.categoryName ? ` (${need.categoryName})` : ""}`);
      if (s.matchedStages.length) parts.push(`works with ${STAGE_LABELS[s.matchedStages[0] as StartupStage]}-stage startups`);
      if (s.matchedIndustries.length) parts.push(`knows ${s.matchedIndustries.slice(0, 2).join(" & ")}`);
      const reason = parts.join(" · ");
      return { consultant: card, reason: reason.charAt(0).toUpperCase() + reason.slice(1) };
    })
    .filter((r): r is RecommendedConsultant => !!r);
}
