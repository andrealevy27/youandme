import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as s from "@/server/db/schema";
import { createUser, resetDatabase } from "../support/db";
import { getAvailableSlots, getRecommendedConsultantsForUser, searchConsultants } from "@/server/consultants";
import { cancelBooking, completeBooking, createBooking, getBookingForViewer } from "@/server/bookings";
import { refundBooking, startCheckout } from "@/server/payments";
import { submitReview } from "@/server/reviews";

beforeEach(async () => {
  await resetDatabase();
});

async function makeConsultant(opts: { categories?: string[]; headline?: string; bio?: string; price?: number; stages?: string[] } = {}) {
  const u = await createUser({ roles: ["consultant"] });
  await db.insert(s.consultantProfiles).values({
    userId: u.id,
    headline: opts.headline ?? "TikTok growth for consumer apps",
    bio: opts.bio ?? "I help consumer startups find acquisition channels.",
    timezone: "UTC",
    minNoticeHours: 0,
    status: "approved",
    stagesServed: opts.stages ?? ["mvp"],
  });
  const cats = await db.select().from(s.consultantCategories);
  const catIds = (opts.categories ?? ["growth"]).map((slug) => cats.find((c) => c.slug === slug)!.id);
  await db.insert(s.consultantProfileCategories).values(catIds.map((categoryId) => ({ consultantId: u.id, categoryId })));
  const [service] = await db
    .insert(s.consultantServices)
    .values({ consultantId: u.id, categoryId: catIds[0], title: "Strategy Session", description: "A focused 60-minute session.", pricingType: "fixed", priceCents: opts.price ?? 25_000, durationMinutes: 60 })
    .returning();
  // Available every day, all day (UTC) so tests never depend on the clock.
  await db.insert(s.consultantAvailability).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ consultantId: u.id, weekday, startMinute: 0, endMinute: 1440 })));
  return { ...u, serviceId: service!.id };
}

async function firstSlot(consultantId: string, serviceId: string, index = 0) {
  const { slots } = await getAvailableSlots(consultantId, serviceId, new Date(Date.now() + 2 * 86_400_000), 3);
  return slots[index]!.startsAt;
}

async function paidBooking(consultant: { id: string; serviceId: string }, clientId: string, index = 0) {
  const booking = await createBooking(clientId, { serviceId: consultant.serviceId, startsAt: await firstSlot(consultant.id, consultant.serviceId, index) });
  await startCheckout(clientId, booking.id);
  const [row] = await db.select().from(s.bookings).where(eq(s.bookings.id, booking.id));
  return row!;
}

describe("marketplace search", () => {
  it("filters by category, price and keyword, and excludes unapproved and blocked consultants", async () => {
    const viewer = await createUser();
    const growth = await makeConsultant({ categories: ["growth"], price: 20_000 });
    const legal = await makeConsultant({ categories: ["legal"], headline: "Startup lawyer for incorporation", bio: "Equity and SAFEs.", price: 90_000 });
    const pending = await makeConsultant();
    await db.update(s.consultantProfiles).set({ status: "pending_review" }).where(eq(s.consultantProfiles.userId, pending.id));
    const blocked = await makeConsultant();
    await db.insert(s.blocks).values({ blockerId: viewer.id, blockedId: blocked.id });

    const all = await searchConsultants(viewer.id, {});
    const ids = all.results.map((r) => r.userId);
    expect(ids).toEqual(expect.arrayContaining([growth.id, legal.id]));
    expect(ids).not.toContain(pending.id);
    expect(ids).not.toContain(blocked.id);

    expect((await searchConsultants(viewer.id, { category: "legal" })).results.map((r) => r.userId)).toEqual([legal.id]);
    expect((await searchConsultants(viewer.id, { maxPrice: 50_000 })).results.map((r) => r.userId)).toEqual([growth.id]);
    expect((await searchConsultants(viewer.id, { q: "lawyer" })).results.map((r) => r.userId)).toEqual([legal.id]);
    // New consultants have no rating and never pass a min-rating filter.
    expect((await searchConsultants(viewer.id, { minRating: 4 })).results).toEqual([]);
  });

  it("interprets a described need and explains matches with real data only", async () => {
    const viewer = await createUser();
    const growth = await makeConsultant({ categories: ["growth", "marketing"], price: 25_000 });
    await makeConsultant({ categories: ["legal"], headline: "Startup lawyer", bio: "Incorporation." });
    const res = await searchConsultants(viewer.id, { need: "We need a TikTok acquisition strategy under $500" });
    expect(res.interpreted?.categorySlugs).toContain("growth");
    expect(res.interpreted?.maxBudgetCents).toBe(50_000);
    expect(res.results.map((r) => r.userId)).toEqual([growth.id]);
    expect(res.results[0]!.why.join(" ")).toMatch(/Growth/);
  });

  it("recommends consultants for a user's open needs", async () => {
    const founder = await createUser();
    const growth = await makeConsultant({ categories: ["growth"] });
    const [cat] = await db.select().from(s.consultantCategories).where(eq(s.consultantCategories.slug, "growth"));
    await db.insert(s.needs).values({ ownerId: founder.id, type: "consultant", title: "Growth help", consultantCategoryId: cat!.id });
    const recs = await getRecommendedConsultantsForUser(founder.id);
    expect(recs[0]?.consultant.userId).toBe(growth.id);
    expect(recs[0]?.reason).toContain("Growth help");
  });
});

describe("availability", () => {
  it("returns no slots without rules, and removes booked and time-off slots", async () => {
    const c = await makeConsultant();
    const client = await createUser();
    const from = new Date(Date.now() + 2 * 86_400_000);
    const before = await getAvailableSlots(c.id, c.serviceId, from, 2);
    expect(before.slots.length).toBeGreaterThan(0);

    const taken = before.slots[0]!.startsAt;
    await createBooking(client.id, { serviceId: c.serviceId, startsAt: taken });
    const after = await getAvailableSlots(c.id, c.serviceId, from, 2);
    expect(after.slots.some((sl) => sl.startsAt.getTime() === taken.getTime())).toBe(false);

    await db.insert(s.consultantTimeOff).values({ consultantId: c.id, day: after.slots[0]!.localDate });
    const withOff = await getAvailableSlots(c.id, c.serviceId, from, 2);
    expect(withOff.slots.some((sl) => sl.localDate === after.slots[0]!.localDate)).toBe(false);

    await db.delete(s.consultantAvailability).where(eq(s.consultantAvailability.consultantId, c.id));
    const none = await getAvailableSlots(c.id, c.serviceId, from, 7);
    expect(none).toMatchObject({ hasRules: false, slots: [] });
  });
});

describe("booking lifecycle", () => {
  it("snapshots price and fee, and prevents double booking", async () => {
    const c = await makeConsultant({ price: 25_000 });
    const a = await createUser();
    const b = await createUser();
    const startsAt = await firstSlot(c.id, c.serviceId);
    const booking = await createBooking(a.id, { serviceId: c.serviceId, startsAt });
    expect(booking).toMatchObject({ status: "pending_payment", amountCents: 25_000, platformFeeCents: 2_500 });
    await expect(createBooking(b.id, { serviceId: c.serviceId, startsAt })).rejects.toThrow(/taken|no longer available/);
    // Concurrent attempts: exactly one wins.
    const next = await firstSlot(c.id, c.serviceId, 2);
    const results = await Promise.allSettled([createBooking(a.id, { serviceId: c.serviceId, startsAt: next }), createBooking(b.id, { serviceId: c.serviceId, startsAt: next })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("rejects teammates who aren't members of the startup, and non-managers booking for it", async () => {
    const c = await makeConsultant();
    const founder = await createUser();
    const employee = await createUser();
    const outsider = await createUser();
    const [startup] = await db.insert(s.startups).values({ slug: `st-${founder.id.slice(0, 6)}`, name: "Acme" }).returning();
    await db.insert(s.startupMembers).values([
      { startupId: startup!.id, userId: founder.id, role: "founder", isAdmin: true },
      { startupId: startup!.id, userId: employee.id, role: "employee" },
    ]);
    const startsAt = await firstSlot(c.id, c.serviceId);
    await expect(createBooking(founder.id, { serviceId: c.serviceId, startsAt, startupId: startup!.id, teammateIds: [outsider.id] })).rejects.toThrow(/members/);
    await expect(createBooking(employee.id, { serviceId: c.serviceId, startsAt, startupId: startup!.id })).rejects.toThrow(/permission/);
    const ok = await createBooking(founder.id, { serviceId: c.serviceId, startsAt, startupId: startup!.id, teammateIds: [employee.id] });
    const participants = await db.select().from(s.bookingParticipants).where(eq(s.bookingParticipants.bookingId, ok.id));
    expect(participants.map((p) => p.role).sort()).toEqual(["client", "consultant", "teammate"]);
  });

  it("confirms via dev payments, opens a group chat, notifies everyone and is idempotent", async () => {
    const c = await makeConsultant();
    const founder = await createUser();
    const mate = await createUser();
    const [startup] = await db.insert(s.startups).values({ slug: `st-${founder.id.slice(0, 6)}`, name: "Acme" }).returning();
    await db.insert(s.startupMembers).values([
      { startupId: startup!.id, userId: founder.id, role: "founder", isAdmin: true },
      { startupId: startup!.id, userId: mate.id, role: "cofounder" },
    ]);
    const booking = await createBooking(founder.id, { serviceId: c.serviceId, startsAt: await firstSlot(c.id, c.serviceId), startupId: startup!.id, teammateIds: [mate.id] });
    const res = await startCheckout(founder.id, booking.id, { groupChat: true });
    expect(res.testMode).toBe(true);
    const [row] = await db.select().from(s.bookings).where(eq(s.bookings.id, booking.id));
    expect(row!.status).toBe("confirmed");
    const [convo] = await db.select().from(s.conversations).where(eq(s.conversations.id, row!.conversationId!));
    expect(convo!.type).toBe("booking");
    const members = await db.select().from(s.conversationMembers).where(eq(s.conversationMembers.conversationId, convo!.id));
    expect(members).toHaveLength(3);
    const notes = await db.select().from(s.notifications).where(eq(s.notifications.type, "booking"));
    expect(new Set(notes.map((n) => n.userId))).toEqual(new Set([c.id, founder.id, mate.id]));
    await expect(startCheckout(founder.id, booking.id)).rejects.toThrow(/doesn't need payment/);
  });

  it("uses a 1:1 consultant thread without the group-chat opt-in", async () => {
    const c = await makeConsultant();
    const client = await createUser();
    const b = await paidBooking(c, client.id);
    const [convo] = await db.select().from(s.conversations).where(eq(s.conversations.id, b.conversationId!));
    expect(convo!.type).toBe("consultant");
  });

  it("cancels with a refund, and releases the slot", async () => {
    const c = await makeConsultant();
    const client = await createUser();
    const b = await paidBooking(c, client.id);
    const cancelled = await cancelBooking(c.id, { bookingId: b.id, reason: "Sick" });
    expect(cancelled.status).toBe("refunded");
    const [payment] = await db.select().from(s.payments).where(eq(s.payments.bookingId, b.id));
    expect(payment!.status).toBe("refunded");
    const audit = await db.select().from(s.auditLogs).where(and(eq(s.auditLogs.targetId, b.id), eq(s.auditLogs.action, "booking.cancelled")));
    expect(audit).toHaveLength(1);
    await expect(createBooking(client.id, { serviceId: c.serviceId, startsAt: b.startsAt })).resolves.toBeTruthy();
  });

  it("only allows completion after the session and reviews only after completion", async () => {
    const c = await makeConsultant();
    const client = await createUser();
    const b = await paidBooking(c, client.id);
    const review = { bookingId: b.id, expertise: 5, communication: 4, value: 4, reliability: 5, body: "Great." };
    await expect(submitReview(client.id, review)).rejects.toThrow(/completed/);
    await expect(completeBooking(c.id, b.id)).rejects.toThrow(/ended/);

    // Move the session into the past.
    const past = new Date(Date.now() - 3 * 3_600_000);
    await db.update(s.bookings).set({ startsAt: past, endsAt: new Date(past.getTime() + 3_600_000) }).where(eq(s.bookings.id, b.id));
    await expect(completeBooking(client.id, b.id)).rejects.toThrow(/Only the consultant/);
    await completeBooking(c.id, b.id);
    const [reqNote] = await db.select().from(s.notifications).where(and(eq(s.notifications.userId, client.id), eq(s.notifications.type, "review_request")));
    expect(reqNote).toBeTruthy();

    const stranger = await createUser();
    await expect(submitReview(stranger.id, review)).rejects.toThrow(/Only the person/);
    const created = await submitReview(client.id, review);
    expect(created.overall).toBe(5); // round(18/4 = 4.5)
    await expect(submitReview(client.id, review)).rejects.toThrow(/already/);
    const [profile] = await db.select().from(s.consultantProfiles).where(eq(s.consultantProfiles.userId, c.id));
    expect(profile).toMatchObject({ reviewCount: 1, ratingAvg: 5 });

    const detail = await getBookingForViewer(client.id, b.id);
    expect(detail.can.review).toBe(false);
    await expect(getBookingForViewer(stranger.id, b.id)).rejects.toThrow(/could not be found/);
  });

  it("refunds a confirmed booking (admin path) with an audit entry", async () => {
    const c = await makeConsultant();
    const client = await createUser();
    const admin = await createUser();
    const b = await paidBooking(c, client.id);
    const refunded = await refundBooking(b.id, admin.id);
    expect(refunded.status).toBe("refunded");
    const audit = await db.select().from(s.auditLogs).where(and(eq(s.auditLogs.targetId, b.id), eq(s.auditLogs.action, "payment.refund")));
    expect(audit).toHaveLength(1);
    await expect(refundBooking(b.id, admin.id)).rejects.toThrow(/can't be refunded/);
  });
});
