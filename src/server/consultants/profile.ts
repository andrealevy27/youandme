import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  bookings,
  consultantPortfolioItems,
  consultantProfiles,
  consultantServices,
  consultantCategories,
  personalityProfiles,
  profiles,
  reviews,
  savedItems,
} from "../db/schema";
import { isBlockedEitherWay } from "../privacy/visibility";
import { track } from "../analytics";
import { findUserIdByHandle } from "../people";
import { getConsultantCards, type ConsultantCard } from "./cards";
import { paymentAvailability, type PaymentAvailability } from "../payments/availability";

export type ConsultantServiceDetail = typeof consultantServices.$inferSelect & { categoryName: string | null };

export type ReviewAggregate = {
  count: number;
  overall: number | null;
  expertise: number | null;
  communication: number | null;
  value: number | null;
  reliability: number | null;
};

export type PublicReview = {
  id: string;
  overall: number;
  expertise: number;
  communication: number;
  value: number;
  reliability: number;
  body: string | null;
  createdAt: Date;
  reviewer: { name: string; handle: string; avatarUrl: string | null; isDemo: boolean };
  serviceTitle: string | null;
};

export type ConsultantProfileView = {
  card: ConsultantCard;
  profile: {
    status: (typeof consultantProfiles.$inferSelect)["status"];
    timezone: string;
    minNoticeHours: number;
    engagementCount: number;
    bio: string | null;
    linkedinUrl: string | null;
    websiteUrl: string | null;
  };
  services: ConsultantServiceDetail[];
  portfolio: (typeof consultantPortfolioItems.$inferSelect)[];
  reviews: PublicReview[];
  aggregate: ReviewAggregate;
  personality: Record<string, number> | null;
  isOwn: boolean;
  isSaved: boolean;
  payment: PaymentAvailability;
};

export async function getActiveServices(consultantId: string): Promise<ConsultantServiceDetail[]> {
  const rows = await db
    .select({ s: consultantServices, categoryName: consultantCategories.name })
    .from(consultantServices)
    .leftJoin(consultantCategories, eq(consultantCategories.id, consultantServices.categoryId))
    .where(and(eq(consultantServices.consultantId, consultantId), eq(consultantServices.active, true), isNull(consultantServices.deletedAt)))
    .orderBy(asc(consultantServices.sortOrder), asc(consultantServices.priceCents));
  return rows.map((r) => ({ ...r.s, categoryName: r.categoryName }));
}

export async function getReviewAggregate(consultantId: string): Promise<ReviewAggregate> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      overall: sql<number | null>`avg(${reviews.overall})::float`,
      expertise: sql<number | null>`avg(${reviews.expertise})::float`,
      communication: sql<number | null>`avg(${reviews.communication})::float`,
      value: sql<number | null>`avg(${reviews.value})::float`,
      reliability: sql<number | null>`avg(${reviews.reliability})::float`,
    })
    .from(reviews)
    .where(and(eq(reviews.consultantId, consultantId), eq(reviews.status, "published")));
  return row ?? { count: 0, overall: null, expertise: null, communication: null, value: null, reliability: null };
}

export async function listPublicReviews(consultantId: string, limit = 20): Promise<PublicReview[]> {
  const rows = await db.execute<{
    id: string;
    overall: number;
    expertise: number;
    communication: number;
    value: number;
    reliability: number;
    body: string | null;
    created_at: string;
    name: string;
    handle: string;
    avatar_url: string | null;
    is_demo: boolean;
    service_title: string | null;
  }>(sql`
    select r.id, r.overall, r.expertise, r.communication, r.value, r.reliability, r.body, r.created_at,
      p.display_name as name, p.handle, p.avatar_url, p.is_demo, b.service_title
    from ${reviews} r
    join ${profiles} p on p.user_id = r.reviewer_id
    left join ${bookings} b on b.id = r.booking_id
    where r.consultant_id = ${consultantId} and r.status = 'published'
    order by r.created_at desc limit ${limit}`);
  return rows.map((r) => ({
    id: r.id,
    overall: r.overall,
    expertise: r.expertise,
    communication: r.communication,
    value: r.value,
    reliability: r.reliability,
    body: r.body,
    createdAt: new Date(r.created_at),
    reviewer: { name: r.name, handle: r.handle, avatarUrl: r.avatar_url, isDemo: r.is_demo },
    serviceTitle: r.service_title,
  }));
}

/**
 * Public consultant profile by handle. Returns null when not found, not approved
 * (unless it's the viewer's own), hidden, deleted, or blocked either way.
 */
export async function getConsultantProfileByHandle(viewerId: string, handle: string): Promise<ConsultantProfileView | null> {
  const userId = await findUserIdByHandle(handle);
  if (!userId) return null;
  const [row] = await db
    .select({ c: consultantProfiles, p: profiles })
    .from(consultantProfiles)
    .innerJoin(profiles, eq(profiles.userId, consultantProfiles.userId))
    .where(eq(consultantProfiles.userId, userId))
    .limit(1);
  if (!row) return null;
  const isOwn = viewerId === userId;
  if (!isOwn) {
    if (row.c.status !== "approved" || row.p.status !== "active" || row.p.deletedAt || row.p.visibility === "hidden") return null;
    if (await isBlockedEitherWay(viewerId, userId)) return null;
  }

  const [cards, services, portfolio, reviewList, aggregate, personality, saved] = await Promise.all([
    getConsultantCards([userId]),
    getActiveServices(userId),
    db.select().from(consultantPortfolioItems).where(eq(consultantPortfolioItems.consultantId, userId)).orderBy(asc(consultantPortfolioItems.sortOrder), desc(consultantPortfolioItems.createdAt)),
    listPublicReviews(userId),
    getReviewAggregate(userId),
    db.select().from(personalityProfiles).where(eq(personalityProfiles.userId, userId)).limit(1),
    db
      .select({ id: savedItems.id })
      .from(savedItems)
      .where(and(eq(savedItems.userId, viewerId), eq(savedItems.targetType, "consultant"), eq(savedItems.targetId, userId)))
      .limit(1),
  ]);
  if (!isOwn) track("consultant_viewed", viewerId, { consultantId: userId });
  return {
    card: cards[0]!,
    profile: {
      status: row.c.status,
      timezone: row.c.timezone,
      minNoticeHours: row.c.minNoticeHours,
      engagementCount: row.c.engagementCount,
      bio: row.c.bio,
      linkedinUrl: row.p.linkedinUrl,
      websiteUrl: row.p.websiteUrl,
    },
    services,
    portfolio,
    reviews: reviewList,
    aggregate,
    personality: personality[0]?.scores ?? null,
    isOwn,
    isSaved: !!saved[0],
    payment: paymentAvailability({ stripeAccountId: row.c.stripeAccountId, stripeChargesEnabled: row.c.stripeChargesEnabled }),
  };
}
