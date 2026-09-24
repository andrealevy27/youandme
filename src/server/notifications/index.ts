import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { notificationPreferences, notifications, user } from "../db/schema";
import { emailLayout, sendEmail } from "../email";
import { env } from "../env";
import { logger } from "../logger";
import type { NotificationType } from "@/lib/domain";

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

export { EMAIL_DEFAULT_ON };
