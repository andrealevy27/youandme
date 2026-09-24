import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  account,
  aiThreads,
  bookings,
  connections,
  consultantProfiles,
  consultantServices,
  conversationMembers,
  educations,
  experiences,
  fileUploads,
  follows,
  identityVerifications,
  interests,
  matchPreferences,
  matches,
  messages,
  needs,
  notificationPreferences,
  notifications,
  payments,
  personalityAnswers,
  personalityProfiles,
  profiles,
  recommendations,
  reviews,
  savedCollections,
  savedItems,
  session,
  startupMembers,
  startups,
  user as userTable,
  userIndustries,
  userRoles,
  userSkills,
} from "../db/schema";
import { audit } from "../audit";
import { AppError } from "../errors";
import { randomSuffix } from "@/lib/slug";

/**
 * Delete an account.
 *
 * Personal data is erased; records other people or the law depend on are kept
 * but anonymised: messages stay visible to the other participants under
 * "Deleted member", and bookings/payments/reviews are retained for financial
 * and dispute records without identifying details.
 */
export async function deleteAccount(userId: string, opts: { confirmation: string; ip?: string | null }) {
  if (opts.confirmation !== "DELETE") throw new AppError("VALIDATION", "Type DELETE to confirm.");
  const [openBooking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(or(eq(bookings.clientId, userId), eq(bookings.consultantId, userId)), inArray(bookings.status, ["pending_payment", "confirmed"])))
    .limit(1);
  if (openBooking) {
    throw new AppError("CONFLICT", "You have upcoming bookings. Cancel or complete them before deleting your account.");
  }

  const anonHandle = `deleted-${randomSuffix(10)}`;
  await db.transaction(async (tx) => {
    // Startups where this user is the only remaining admin are hidden with them.
    const memberships = await tx
      .select({ startupId: startupMembers.startupId })
      .from(startupMembers)
      .where(and(eq(startupMembers.userId, userId), isNull(startupMembers.removedAt), sql`(${startupMembers.isAdmin} or ${startupMembers.role} = 'founder')`));
    for (const m of memberships) {
      const [others] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(startupMembers)
        .where(
          and(
            eq(startupMembers.startupId, m.startupId),
            isNull(startupMembers.removedAt),
            sql`${startupMembers.userId} <> ${userId}`,
            sql`(${startupMembers.isAdmin} or ${startupMembers.role} = 'founder')`,
          ),
        );
      if (!others?.n) await tx.update(startups).set({ deletedAt: new Date(), visibility: "hidden" }).where(eq(startups.id, m.startupId));
    }
    await tx.update(startupMembers).set({ removedAt: new Date() }).where(and(eq(startupMembers.userId, userId), isNull(startupMembers.removedAt)));

    await tx
      .update(profiles)
      .set({
        handle: anonHandle,
        displayName: "Deleted member",
        headline: null,
        bio: null,
        avatarUrl: null,
        location: null,
        city: null,
        country: null,
        university: null,
        currentRole: null,
        currentCompany: null,
        linkedinUrl: null,
        websiteUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        lookingFor: null,
        goals: null,
        equityExpectation: null,
        intents: [],
        cofounderTypes: [],
        stagePreferences: [],
        lookingForCofounder: false,
        visibility: "hidden",
        status: "deleted",
        featured: false,
        deletedAt: new Date(),
      })
      .where(eq(profiles.userId, userId));
    await tx
      .update(userTable)
      .set({ name: "Deleted member", email: `deleted+${userId}@deleted.youandme.invalid`, image: null, emailVerified: false })
      .where(eq(userTable.id, userId));

    // Sign-in methods and sessions.
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));

    // Personal data with no retention need.
    await tx.delete(userSkills).where(eq(userSkills.userId, userId));
    await tx.delete(userIndustries).where(eq(userIndustries.userId, userId));
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.delete(experiences).where(eq(experiences.userId, userId));
    await tx.delete(educations).where(eq(educations.userId, userId));
    await tx.delete(personalityAnswers).where(eq(personalityAnswers.userId, userId));
    await tx.delete(personalityProfiles).where(eq(personalityProfiles.userId, userId));
    await tx.delete(identityVerifications).where(eq(identityVerifications.userId, userId));
    await tx.delete(matchPreferences).where(eq(matchPreferences.userId, userId));
    await tx.delete(recommendations).where(or(eq(recommendations.userId, userId), eq(recommendations.candidateId, userId)));
    await tx.delete(interests).where(or(eq(interests.fromUserId, userId), eq(interests.toUserId, userId)));
    await tx.update(matches).set({ unmatchedAt: new Date() }).where(and(or(eq(matches.userAId, userId), eq(matches.userBId, userId)), isNull(matches.unmatchedAt)));
    await tx.delete(connections).where(or(eq(connections.requesterId, userId), eq(connections.addresseeId, userId)));
    await tx.delete(follows).where(eq(follows.followerId, userId));
    await tx.delete(savedItems).where(eq(savedItems.userId, userId));
    await tx.delete(savedCollections).where(eq(savedCollections.userId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    await tx.delete(aiThreads).where(eq(aiThreads.userId, userId));
    await tx.delete(needs).where(and(eq(needs.ownerId, userId), isNull(needs.startupId)));
    await tx.delete(fileUploads).where(eq(fileUploads.userId, userId));

    // Consultant presence is withdrawn; historical bookings keep their snapshot.
    await tx.update(consultantProfiles).set({ status: "suspended", acceptingClients: false, bio: null, featured: false }).where(eq(consultantProfiles.userId, userId));
    await tx.update(consultantServices).set({ active: false, deletedAt: new Date() }).where(eq(consultantServices.consultantId, userId));

    // Leave every conversation; messages remain for other participants under "Deleted member".
    await tx.update(conversationMembers).set({ leftAt: new Date() }).where(and(eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt)));
    await tx.update(reviews).set({ body: null }).where(eq(reviews.reviewerId, userId));
  });
  await audit({ actorId: userId, action: "account.delete", targetType: "user", targetId: userId, ip: opts.ip ?? null });
}

/** Everything we hold about a user, as portable JSON. */
export async function exportMyData(userId: string) {
  const [
    [profile],
    [authUser],
    skillRows,
    industryRows,
    roleRows,
    exp,
    edu,
    personality,
    memberships,
    needRows,
    interestRows,
    matchRows,
    connectionRows,
    savedRows,
    sentMessages,
    bookingRows,
    paymentRows,
    reviewRows,
    prefs,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)),
    db.select({ id: userTable.id, name: userTable.name, email: userTable.email, emailVerified: userTable.emailVerified, createdAt: userTable.createdAt }).from(userTable).where(eq(userTable.id, userId)),
    db.select().from(userSkills).where(eq(userSkills.userId, userId)),
    db.select().from(userIndustries).where(eq(userIndustries.userId, userId)),
    db.select().from(userRoles).where(eq(userRoles.userId, userId)),
    db.select().from(experiences).where(eq(experiences.userId, userId)),
    db.select().from(educations).where(eq(educations.userId, userId)),
    db.select().from(personalityAnswers).where(eq(personalityAnswers.userId, userId)),
    db.select().from(startupMembers).where(eq(startupMembers.userId, userId)),
    db.select().from(needs).where(eq(needs.ownerId, userId)),
    db.select().from(interests).where(eq(interests.fromUserId, userId)),
    db.select().from(matches).where(or(eq(matches.userAId, userId), eq(matches.userBId, userId))),
    db.select().from(connections).where(or(eq(connections.requesterId, userId), eq(connections.addresseeId, userId))),
    db.select().from(savedItems).where(eq(savedItems.userId, userId)),
    db.select({ id: messages.id, conversationId: messages.conversationId, body: messages.body, attachments: messages.attachments, createdAt: messages.createdAt }).from(messages).where(eq(messages.senderId, userId)).limit(20_000),
    db.select().from(bookings).where(or(eq(bookings.clientId, userId), eq(bookings.consultantId, userId))),
    db
      .select({ id: payments.id, bookingId: payments.bookingId, provider: payments.provider, amountCents: payments.amountCents, currency: payments.currency, status: payments.status, createdAt: payments.createdAt })
      .from(payments)
      .where(eq(payments.payerId, userId)),
    db.select().from(reviews).where(eq(reviews.reviewerId, userId)),
    db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    format: "youandme-export-v1",
    account: authUser,
    profile,
    roles: roleRows.map((r) => r.role),
    skills: skillRows,
    industries: industryRows,
    experiences: exp,
    educations: edu,
    workingStyleAnswers: personality,
    startupMemberships: memberships,
    needs: needRows,
    cofounderInterests: interestRows,
    matches: matchRows,
    connections: connectionRows,
    saved: savedRows,
    messagesSent: sentMessages,
    bookings: bookingRows,
    payments: paymentRows,
    reviewsWritten: reviewRows,
    notificationPreferences: prefs,
  };
}
