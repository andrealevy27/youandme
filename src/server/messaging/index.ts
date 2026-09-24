import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "../db";
import { conversationMembers, conversations, messageReactions, messages, profiles } from "../db/schema";
import type { MessageAttachment } from "../db/schema/messaging";
import { AppError, forbidden, notFound } from "../errors";
import { notify } from "../notifications";
import { isBlockedEitherWay } from "../privacy/visibility";
import { enforceRateLimit } from "../rate-limit";
import { track } from "../analytics";
import type { ConversationType } from "@/lib/domain";

export const ALLOWED_REACTIONS = ["👍", "❤️", "🔥", "😂", "🎉", "👀"] as const;

export const sendMessageInput = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().max(5000).default(""),
  attachments: z
    .array(z.object({ url: z.string().min(1).max(1000), name: z.string().max(200), size: z.number().int().nonnegative(), mime: z.string().max(100) }))
    .max(5)
    .optional(),
});

/** Authorization gate for every conversation read/write. */
export async function assertMember(conversationId: string, userId: string, conn: DbOrTx = db) {
  const [m] = await conn
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt)))
    .limit(1);
  if (!m) throw forbidden("You're not part of this conversation.");
  return m;
}

export async function createConversation(
  input: {
    type: ConversationType;
    memberIds: string[];
    createdById: string | null;
    title?: string | null;
    startupId?: string | null;
    bookingId?: string | null;
    matchId?: string | null;
    directKey?: string | null;
  },
  conn: DbOrTx = db,
) {
  const [convo] = await conn
    .insert(conversations)
    .values({
      type: input.type,
      title: input.title ?? null,
      startupId: input.startupId ?? null,
      bookingId: input.bookingId ?? null,
      matchId: input.matchId ?? null,
      directKey: input.directKey ?? null,
      createdById: input.createdById,
    })
    .returning();
  const unique = [...new Set(input.memberIds)];
  await conn.insert(conversationMembers).values(
    unique.map((userId) => ({ conversationId: convo!.id, userId, role: userId === input.createdById ? "admin" : "member" })),
  );
  return convo!;
}

export const directKeyFor = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Get or create the single 1:1 thread between two people. */
export async function ensureDirectConversation(viewerId: string, otherId: string, type: ConversationType = "direct", conn: DbOrTx = db) {
  if (viewerId === otherId) throw new AppError("VALIDATION", "You can't message yourself.");
  if (await isBlockedEitherWay(viewerId, otherId, conn)) throw forbidden("You can't message this person.");
  const key = directKeyFor(viewerId, otherId);
  const [existing] = await conn.select().from(conversations).where(eq(conversations.directKey, key)).limit(1);
  if (existing) return existing;
  try {
    return await createConversation({ type, memberIds: [viewerId, otherId], createdById: viewerId, directKey: key }, conn);
  } catch {
    // Lost a race with a concurrent create — the unique directKey guarantees one thread.
    const [row] = await conn.select().from(conversations).where(eq(conversations.directKey, key)).limit(1);
    if (!row) throw new AppError("CONFLICT", "Couldn't start the conversation. Please try again.");
    return row;
  }
}

export async function addSystemMessage(conversationId: string, body: string, conn: DbOrTx = db) {
  await conn.insert(messages).values({ conversationId, senderId: null, kind: "system", body });
  await conn.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
}

export async function sendMessage(senderId: string, raw: z.input<typeof sendMessageInput>) {
  const input = sendMessageInput.parse(raw);
  if (!input.body && !input.attachments?.length) throw new AppError("VALIDATION", "Write a message first.");
  enforceRateLimit("message", senderId);
  await assertMember(input.conversationId, senderId);

  const [convo] = await db.select().from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
  if (!convo) throw notFound("Conversation");
  const others = await db
    .select({ userId: conversationMembers.userId, mutedAt: conversationMembers.mutedAt })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, convo.id), ne(conversationMembers.userId, senderId), isNull(conversationMembers.leftAt)));
  if (convo.directKey && others[0] && (await isBlockedEitherWay(senderId, others[0].userId))) {
    throw forbidden("You can't message this person.");
  }

  const attachments: MessageAttachment[] | null = input.attachments?.length ? input.attachments : null;
  const kind = attachments?.every((a) => a.mime.startsWith("image/")) ? "image" : attachments ? "file" : "text";
  const now = new Date();
  const [msg] = await db
    .insert(messages)
    .values({ conversationId: convo.id, senderId, body: input.body, attachments, kind, createdAt: now })
    .returning();
  await db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, convo.id));
  await db
    .update(conversationMembers)
    .set({ lastReadAt: now, typingAt: null })
    .where(and(eq(conversationMembers.conversationId, convo.id), eq(conversationMembers.userId, senderId)));

  const [sender] = await db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.userId, senderId)).limit(1);
  // Notify only on the first unread message to avoid a notification per message.
  for (const o of others) {
    if (o.mutedAt) continue;
    const [prevUnread] = await db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, o.userId)))
      .where(
        and(
          eq(messages.conversationId, convo.id),
          ne(messages.id, msg!.id),
          sql`${messages.createdAt} > coalesce(${conversationMembers.lastReadAt}, 'epoch'::timestamptz)`,
        ),
      )
      .limit(1);
    if (!prevUnread) {
      await notify({
        userId: o.userId,
        type: "new_message",
        title: `New message from ${sender?.name ?? "someone"}`,
        body: input.body ? input.body.slice(0, 140) : "Sent an attachment",
        href: `/messages/${convo.id}`,
        actorId: senderId,
      });
    }
  }
  track("message_sent", senderId, { conversationType: convo.type, hasAttachment: !!attachments });
  return msg!;
}

export type InboxItem = Awaited<ReturnType<typeof listInbox>>[number];

/** Inbox: conversations with last message, unread count and the other participants. */
export async function listInbox(userId: string, opts: { type?: ConversationType; limit?: number } = {}) {
  const rows = await db
    .select({ convo: conversations, lastReadAt: conversationMembers.lastReadAt, mutedAt: conversationMembers.mutedAt })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(and(eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt), opts.type ? eq(conversations.type, opts.type) : undefined))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(Math.min(opts.limit ?? 50, 100));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.convo.id);

  const [memberRows, lastMessages, unreadRows] = await Promise.all([
    db
      .select({ conversationId: conversationMembers.conversationId, userId: profiles.userId, name: profiles.displayName, avatarUrl: profiles.avatarUrl, handle: profiles.handle })
      .from(conversationMembers)
      .innerJoin(profiles, eq(profiles.userId, conversationMembers.userId))
      .where(and(inArray(conversationMembers.conversationId, ids), ne(conversationMembers.userId, userId), isNull(conversationMembers.leftAt))),
    db
      .selectDistinctOn([messages.conversationId], {
        conversationId: messages.conversationId,
        body: messages.body,
        kind: messages.kind,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(inArray(messages.conversationId, ids), isNull(messages.deletedAt)))
      .orderBy(messages.conversationId, desc(messages.createdAt)),
    db
      .select({ conversationId: messages.conversationId, n: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, userId)))
      .where(
        and(
          inArray(messages.conversationId, ids),
          sql`${messages.senderId} is distinct from ${userId}`,
          sql`${messages.createdAt} > coalesce(${conversationMembers.lastReadAt}, 'epoch'::timestamptz)`,
        ),
      )
      .groupBy(messages.conversationId),
  ]);

  return rows.map((r) => ({
    ...r.convo,
    muted: !!r.mutedAt,
    participants: memberRows.filter((m) => m.conversationId === r.convo.id),
    lastMessage: lastMessages.find((m) => m.conversationId === r.convo.id) ?? null,
    unread: unreadRows.find((u) => u.conversationId === r.convo.id)?.n ?? 0,
  }));
}

export async function totalUnreadConversations(userId: string) {
  const [row] = await db.execute<{ n: number }>(sql`
    select count(distinct m.conversation_id)::int as n from ${messages} m
    join ${conversationMembers} cm on cm.conversation_id = m.conversation_id and cm.user_id = ${userId} and cm.left_at is null
    where m.sender_id is distinct from ${userId} and m.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)`);
  return Number(row?.n ?? 0);
}

export async function getConversation(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  const [convo] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!convo) throw notFound("Conversation");
  const members = await db
    .select({
      userId: profiles.userId,
      name: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      handle: profiles.handle,
      headline: profiles.headline,
      lastReadAt: conversationMembers.lastReadAt,
      typingAt: conversationMembers.typingAt,
    })
    .from(conversationMembers)
    .innerJoin(profiles, eq(profiles.userId, conversationMembers.userId))
    .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)));
  return { ...convo, members };
}

/** Paginated messages (newest page first, returned oldest→newest), or only messages after a timestamp for polling. */
export async function listMessages(conversationId: string, userId: string, opts: { before?: Date; after?: Date; limit?: number } = {}) {
  await assertMember(conversationId, userId);
  const limit = Math.min(opts.limit ?? 50, 100);
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        opts.before ? lt(messages.createdAt, opts.before) : undefined,
        opts.after ? gt(messages.createdAt, opts.after) : undefined,
      ),
    )
    .orderBy(opts.after ? asc(messages.createdAt) : desc(messages.createdAt))
    .limit(limit);
  const ordered = opts.after ? rows : rows.reverse();
  const reactions = ordered.length
    ? await db.select().from(messageReactions).where(inArray(messageReactions.messageId, ordered.map((m) => m.id)))
    : [];
  return ordered.map((m) => ({
    ...m,
    body: m.deletedAt ? "" : m.body,
    attachments: m.deletedAt ? null : m.attachments,
    reactions: reactions.filter((r) => r.messageId === m.id).map((r) => ({ emoji: r.emoji, userId: r.userId })),
  }));
}

export async function markConversationRead(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
}

export async function setTyping(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  await db
    .update(conversationMembers)
    .set({ typingAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
}

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  if (!(ALLOWED_REACTIONS as readonly string[]).includes(emoji)) throw new AppError("VALIDATION", "Unsupported reaction.");
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!msg) throw notFound("Message");
  await assertMember(msg.conversationId, userId);
  const where = and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId), eq(messageReactions.emoji, emoji));
  const [existing] = await db.select().from(messageReactions).where(where).limit(1);
  if (existing) await db.delete(messageReactions).where(where);
  else await db.insert(messageReactions).values({ messageId, userId, emoji });
}

export async function deleteMessage(messageId: string, userId: string) {
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!msg) throw notFound("Message");
  if (msg.senderId !== userId) throw forbidden("You can only delete your own messages.");
  await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));
}

export async function setMuted(conversationId: string, userId: string, muted: boolean) {
  await assertMember(conversationId, userId);
  await db
    .update(conversationMembers)
    .set({ mutedAt: muted ? new Date() : null })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
}
