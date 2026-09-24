import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "../db";
import { notificationPreferences, notifications, profiles, user } from "../db/schema";
import { emailLayout, sendEmail } from "../email";
import { env } from "../env";
import { logger } from "../logger";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/domain";

/** Types that default to email-on. Everything else is in-app only unless the user opts in. */
const EMAIL_DEFAULT_ON: NotificationType[] = ["new_match", "booking", "booking_reminder", "startup_invite", "system"];

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  actorId?: string | null;
  data?: Record<string, unknown>;
};

async function preferenceFor(userId: string, type: NotificationType, conn: DbOrTx) {
  const [pref] = await conn
    .select()
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)))
    .limit(1);
  return pref ?? { inApp: true, email: EMAIL_DEFAULT_ON.includes(type), push: false };
}

/**
 * The only way the app creates notifications. Every notification corresponds to a
 * real event; respects per-type preferences (security notices are always delivered).
 */
export async function notify(input: NotifyInput, conn: DbOrTx = db) {
  if (input.actorId && input.actorId === input.userId) return;
  const pref = await preferenceFor(input.userId, input.type, conn);
  const mandatory = input.type === "system";
  if (pref.inApp || mandatory) {
    await conn.insert(notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      actorId: input.actorId ?? null,
      data: input.data ?? null,
    });
  }
  if (pref.email || mandatory) {
    const [recipient] = await conn.select({ email: user.email }).from(user).where(eq(user.id, input.userId)).limit(1);
    if (recipient) {
      const url = input.href ? `${env.NEXT_PUBLIC_APP_URL}${input.href}` : env.NEXT_PUBLIC_APP_URL;
      void sendEmail({
        to: recipient.email,
        subject: input.title,
        text: `${input.body ?? ""}\n\n${url}`,
        html: emailLayout(input.title, input.body ?? "", { label: "Open You&Me", url }),
      }).catch((err) => logger.warn("notification_email_failed", { err }));
    }
  }
}

export async function listNotifications(userId: string, opts: { cursor?: Date; limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? 30, 100);
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), opts.cursor ? lt(notifications.createdAt, opts.cursor) : undefined))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadNotificationCount(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function markNotificationsRead(userId: string, id?: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), id ? eq(notifications.id, id) : undefined));
}

export async function getNotificationPreferences(userId: string) {
  const rows = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  return rows;
}

export async function setNotificationPreference(
  userId: string,
  type: NotificationType,
  channels: { inApp: boolean; email: boolean; push: boolean },
) {
  await db
    .insert(notificationPreferences)
    .values({ userId, type, ...channels })
    .onConflictDoUpdate({ target: [notificationPreferences.userId, notificationPreferences.type], set: channels });
}

/** Notifications joined with the actor's public profile (name/avatar/handle) for the notifications page and API. */
export async function listNotificationsWithActors(userId: string, opts: { cursor?: Date; limit?: number; unreadOnly?: boolean } = {}) {
  const limit = Math.min(opts.limit ?? 30, 100);
  const rows = await db
    .select({
      n: notifications,
      actor: { userId: profiles.userId, name: profiles.displayName, handle: profiles.handle, avatarUrl: profiles.avatarUrl },
    })
    .from(notifications)
    .leftJoin(profiles, eq(profiles.userId, notifications.actorId))
    .where(
      and(
        eq(notifications.userId, userId),
        opts.cursor ? lt(notifications.createdAt, opts.cursor) : undefined,
        opts.unreadOnly ? isNull(notifications.readAt) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map(({ n, actor }) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href && n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : null,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
    actor: actor?.userId ? actor : null,
  }));
}
export type NotificationDTO = Awaited<ReturnType<typeof listNotificationsWithActors>>[number];

/** Mark notifications pointing at a page as read (e.g. opening a conversation clears its message notification). */
export async function markNotificationsReadByHref(userId: string, href: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), eq(notifications.href, href)));
}

export type PreferenceRow = { type: NotificationType; inApp: boolean; email: boolean; push: boolean; mandatory: boolean };

/** Every notification type with the user's stored choice or the default. */
export async function getNotificationPreferenceMatrix(userId: string): Promise<PreferenceRow[]> {
  const stored = await getNotificationPreferences(userId);
  return NOTIFICATION_TYPES.map((type) => {
    const row = stored.find((r) => r.type === type);
    return {
      type,
      inApp: row?.inApp ?? true,
      email: row?.email ?? EMAIL_DEFAULT_ON.includes(type),
      push: false,
      mandatory: type === "system",
    };
  });
}

export const preferenceInput = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  channel: z.enum(["inApp", "email"]),
  enabled: z.boolean(),
});

/** Toggle one channel for one type. Push stays off until push delivery exists. */
export async function updateNotificationPreference(userId: string, raw: z.input<typeof preferenceInput>) {
  const input = preferenceInput.parse(raw);
  const matrix = await getNotificationPreferenceMatrix(userId);
  const current = matrix.find((r) => r.type === input.type)!;
  const next = { inApp: current.inApp, email: current.email, push: false, [input.channel]: input.enabled };
  await setNotificationPreference(userId, input.type, next);
  return { type: input.type, inApp: next.inApp, email: next.email };
}

export { EMAIL_DEFAULT_ON };
