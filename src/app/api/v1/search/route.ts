import { z } from "zod";
import { jsonRoute } from "@/server/ai/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { searchPeople, searchStartups } from "@/server/search";

/**
 * GET /api/v1/search?type=people|startups&q=…
 *  people:   &tab=people|founders|cofounders|talent &skills=a,b &skillCategories=engineering,ai_ml
 *            &industries=health,ai &commitment= &availability= &location= &stage= &cursor= &limit=≤24
 *            → { items: { person: PersonSummary, matched: string[] }[], nextCursor }
 *  startups: &stage= &industry= &lookingFor=cofounder|consultant|… &cursor= &limit=
 *            → { items: StartupSummary[], nextCursor }
 */
export const GET = jsonRoute(async ({ req, viewer }) => {
  enforceRateLimit("search", viewer.userId);
  const p = new URL(req.url).searchParams;
  const get = (k: string) => p.get(k) || undefined;
  const type = z.enum(["people", "startups"]).default("people").parse(get("type"));
  if (type === "startups") {
    const page = await searchStartups(viewer.userId, {
      q: get("q"),
      stage: get("stage") as never,
      industry: get("industry"),
      lookingFor: get("lookingFor") as never,
      cursor: get("cursor"),
      limit: get("limit") as never,
    });
    return { items: page.items, nextCursor: page.nextCursor };
  }
  const page = await searchPeople(viewer.userId, {
    q: get("q"),
    tab: get("tab") as never,
    cursor: get("cursor"),
    limit: get("limit") as never,
    filters: {
      skills: get("skills"),
      skillCategories: get("skillCategories") as never,
      industries: get("industries"),
      commitment: get("commitment") as never,
      availability: get("availability") as never,
      location: get("location"),
      stage: get("stage") as never,
    },
  });
  return { items: page.items, nextCursor: page.nextCursor };
});
