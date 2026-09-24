import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "../db";
import { conversationMembers, conversations, fileUploads, messageReactions, messages, profiles, startups } from "../db/schema";
import type { MessageAttachment } from "../db/schema/messaging";
import { AppError, forbidden, notFound } from "../errors";
import { markNotificationsReadByHref, notify } from "../notifications";
import { canViewProfile, getBlockedIds, isBlockedEitherWay } from "../privacy/visibility";
import { enforceRateLimit } from "../rate-limit";
import { publishConversationEvent, TYPING_TTL_MS } from "../realtime";
import { track } from "../analytics";
import type { ConversationType } from "@/lib/domain";
import type {
  ConversationStateDTO,
  InboxFilter,
  InboxItemDTO,
  MessageDTO,
  MessagesPageDTO,
  PersonRef,
  ThreadDTO,
} from "@/components/messaging/types";

export const ALLOWED_REACTIONS = ["👍", "❤️", "🔥", "😂", "🎉", "👀"] as const;

export const sendMessageInput = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().max(5000).default(""),
  attachments: z
    .array(z.object({ url: z.string().min(1).max(1000), name: z.string().max(200), size: z.number().int().nonnegative(), mime: z.string().max(100) }))
    .max(5)
    .optional(),
});

/** Inbox tabs. Booking threads are consultant relationships, so they live under Consultants. */
export const FILTER_FOR_TYPE: Record<ConversationType, Exclude<InboxFilter, "all">> = {
  direct: "direct",
  match: "matches",
  consultant: "consultants",
  booking: "consultants",
  startup_group: "startups",
};
const TYPES_FOR_FILTER: Record<Exclude<InboxFilter, "all">, ConversationType[]> = {
  direct: ["direct"],
  matches: ["match"],
  consultants: ["consultant", "booking"],
  startups: ["startup_group"],
};

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
  if (unique.length) {
    await conn.insert(conversationMembers).values(
      unique.map((userId) => ({ conversationId: convo!.id, userId, role: userId === input.createdById ? "admin" : "member" })),
    );
  }
  return convo!;
}

export const directKeyFor = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const otherFromDirectKey = (key: string, viewerId: string) => key.split(":").find((id) => id !== viewerId) ?? null;

/** Get or create the single 1:1 thread between two people. */
export async function ensureDirectConversation(viewerId: string, otherId: string, type: ConversationType = "direct", conn: DbOrTx = db) {
  if (viewerId === otherId) throw new AppError("VALIDATION", "You can't message yourself.");
  if (await isBlockedEitherWay(viewerId, otherId, conn)) throw forbidden("You can't message this person.");
  const key = directKeyFor(viewerId, otherId);
  const [existing] = await conn.select().from(conversations).where(eq(conversations.directKey, key)).limit(1);
  if (existing) {
    // Re-join if either side had left the thread.
    await conn
      .update(conversationMembers)
      .set({ leftAt: null })
      .where(and(eq(conversationMembers.conversationId, existing.id), inArray(conversationMembers.userId, [viewerId, otherId])));
    return existing;
  }
  try {
    return await createConversation({ type, memberIds: [viewerId, otherId], createdById: viewerId, directKey: key }, conn);
  } catch {
    // Lost a race with a concurrent create — the unique directKey guarantees one thread.
    const [row] = await conn.select().from(conversations).where(eq(conversations.directKey, key)).limit(1);
    if (!row) throw new AppError("CONFLICT", "Couldn't start the conversation. Please try again.");
    return row;
  }
}

/**
 * "Message" button on a profile: respects blocks and profile visibility, then returns
 * the single direct thread for the pair (creating it on first use).
 */
export async function startConversationWithUser(viewerId: string, otherUserId: string) {
  if (viewerId === otherUserId) throw new AppError("VALIDATION", "You can't message yourself.");
  if (!(await canViewProfile(viewerId, otherUserId))) throw forbidden("You can't message this person.");
  return ensureDirectConversation(viewerId, otherUserId, "direct");
}

export async function addSystemMessage(conversationId: string, body: string, conn: DbOrTx = db) {
  const now = new Date();
  const [msg] = await conn.insert(messages).values({ conversationId, senderId: null, kind: "system", body, createdAt: now }).returning({ id: messages.id });
  await conn.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversationId));
  publishConversationEvent({ type: "message.created", conversationId, messageId: msg!.id });
}

/** Attachments must be files the sender uploaded; name comes from the client, everything else from our records. */
async function verifyAttachments(senderId: string, raw: MessageAttachment[]): Promise<MessageAttachment[]> {
  if (!raw.length) return [];
  const rows = await db
    .select({ url: fileUploads.url, mime: fileUploads.mime, size: fileUploads.size })
    .from(fileUploads)
    .where(and(eq(fileUploads.userId, senderId), inArray(fileUploads.url, raw.map((a) => a.url))));
  const byUrl = new Map(rows.map((r) => [r.url, r]));
  return raw.map((a) => {
    const row = byUrl.get(a.url);
    if (!row) throw new AppError("VALIDATION", "One of the attachments couldn't be found. Please upload it again.");
    return { url: row.url, mime: row.mime, size: row.size, name: a.name.trim().slice(0, 200) || "file" };
  });
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
  if (convo.directKey) {
    const otherId = otherFromDirectKey(convo.directKey, senderId);
    if (otherId && (await isBlockedEitherWay(senderId, otherId))) throw forbidden("You can't message this person.");
  }

  const verified = await verifyAttachments(senderId, input.attachments ?? []);
  const attachments: MessageAttachment[] | null = verified.length ? verified : null;
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
  publishConversationEvent({ type: "message.created", conversationId: convo.id, messageId: msg!.id });

  const [sender] = await db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.userId, senderId)).limit(1);
  const isGroup = convo.type === "startup_group" || others.length > 1;
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
          sql`${messages.senderId} is distinct from ${o.userId}`,
          sql`${messages.createdAt} > coalesce(${conversationMembers.lastReadAt}, 'epoch'::timestamptz)`,
        ),
      )
      .limit(1);
    if (!prevUnread) {
      await notify({
        userId: o.userId,
        type: "new_message",
        title: isGroup && convo.title ? `${sender?.name ?? "Someone"} in ${convo.title}` : `New message from ${sender?.name ?? "someone"}`,
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

/** Inbox: conversations with last message, unread count and the other participants. Blocked 1:1 threads are hidden for both people. */
export async function listInbox(userId: string, opts: { type?: ConversationType; filter?: InboxFilter; limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const types = opts.type ? [opts.type] : opts.filter && opts.filter !== "all" ? TYPES_FOR_FILTER[opts.filter] : null;
  const blocked = await getBlockedIds(userId);
  const rows = (
    await db
      .select({ convo: conversations, lastReadAt: conversationMembers.lastReadAt, mutedAt: conversationMembers.mutedAt })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
      .where(and(eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt), types ? inArray(conversations.type, types) : undefined))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit + blocked.size)
  )
    .filter((r) => {
      if (!r.convo.directKey) return true;
      const other = otherFromDirectKey(r.convo.directKey, userId);
      return !other || !blocked.has(other);
    })
    .slice(0, limit);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.convo.id);
  const startupIds = [...new Set(rows.map((r) => r.convo.startupId).filter((s): s is string => !!s))];

  const [memberRows, lastMessages, unreadRows, startupRows] = await Promise.all([
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
        attachments: messages.attachments,
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
          isNull(messages.deletedAt),
          ne(messages.kind, "system"),
          sql`${messages.senderId} is distinct from ${userId}`,
          sql`${messages.createdAt} > coalesce(${conversationMembers.lastReadAt}, 'epoch'::timestamptz)`,
        ),
      )
      .groupBy(messages.conversationId),
    startupIds.length
      ? db.select({ id: startups.id, name: startups.name, slug: startups.slug, logoUrl: startups.logoUrl }).from(startups).where(inArray(startups.id, startupIds))
      : Promise.resolve([] as { id: string; name: string; slug: string; logoUrl: string | null }[]),
  ]);

  return rows.map((r) => ({
    ...r.convo,
    muted: !!r.mutedAt,
    participants: memberRows.filter((m) => m.conversationId === r.convo.id),
    lastMessage: lastMessages.find((m) => m.conversationId === r.convo.id) ?? null,
    unread: unreadRows.find((u) => u.conversationId === r.convo.id)?.n ?? 0,
    startup: startupRows.find((s) => s.id === r.convo.startupId) ?? null,
  }));
}

function previewFor(m: { body: string; kind: string; attachments: MessageAttachment[] | null }) {
  if (m.body) return m.body.replace(/\s+/g, " ").slice(0, 120);
  const n = m.attachments?.length ?? 0;
  if (m.kind === "image") return n > 1 ? `${n} photos` : "Photo";
  if (m.kind === "file") return n > 1 ? `${n} files` : (m.attachments?.[0]?.name ?? "File");
  return "";
}

function conversationTitle(
  convo: { type: ConversationType; title: string | null },
  startup: { name: string } | null,
  participants: { name: string }[],
) {
  if (convo.type === "startup_group") return startup?.name ?? convo.title ?? "Team chat";
  if (convo.title) return convo.title;
  if (!participants.length) return "Just you";
  if (participants.length <= 2) return participants.map((p) => p.name).join(" & ");
  return `${participants[0]!.name} and ${participants.length - 1} others`;
}

/** JSON-ready inbox for the web UI and `/api/v1/conversations`. */
export async function listInboxDTO(userId: string, opts: { filter?: InboxFilter; limit?: number } = {}): Promise<InboxItemDTO[]> {
  const items = await listInbox(userId, opts);
  return items.map((c) => {
    const avatars =
      c.type === "startup_group" && c.startup
        ? [{ name: c.startup.name, avatarUrl: c.startup.logoUrl }, ...c.participants.slice(0, 1).map((p) => ({ name: p.name, avatarUrl: p.avatarUrl }))]
        : c.participants.slice(0, 2).map((p) => ({ name: p.name, avatarUrl: p.avatarUrl }));
    const last = c.lastMessage;
    return {
      id: c.id,
      type: c.type,
      filter: FILTER_FOR_TYPE[c.type],
      title: conversationTitle(c, c.startup, c.participants),
      avatars,
      lastMessage: last ? { preview: previewFor(last), fromViewer: last.senderId === userId, createdAt: last.createdAt.toISOString() } : null,
      lastMessageAt: c.lastMessageAt.toISOString(),
      unread: c.unread,
      muted: c.muted,
    };
  });
}

export async function totalUnreadConversations(userId: string) {
  const [row] = await db.execute<{ n: number }>(sql`
    select count(distinct m.conversation_id)::int as n from ${messages} m
    join ${conversationMembers} cm on cm.conversation_id = m.conversation_id and cm.user_id = ${userId} and cm.left_at is null
    join ${conversations} c on c.id = m.conversation_id
    where m.sender_id is distinct from ${userId} and m.deleted_at is null and m.kind <> 'system'
      and m.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
      and (c.direct_key is null or not exists (
        select 1 from blocks b where (b.blocker_id = ${userId} and c.direct_key like '%' || b.blocked_id || '%')
          or (b.blocked_id = ${userId} and c.direct_key like '%' || b.blocker_id || '%')))`);
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

/** Thread header + participants for the thread view and `/api/v1/conversations/:id`. */
export async function getThread(conversationId: string, viewerId: string): Promise<ThreadDTO> {
  const me = await assertMember(conversationId, viewerId);
  const [convo] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!convo) throw notFound("Conversation");
  const [everyone, startupRow] = await Promise.all([
    db
      .select({
        userId: profiles.userId,
        name: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        handle: profiles.handle,
        headline: profiles.headline,
        lastReadAt: conversationMembers.lastReadAt,
        leftAt: conversationMembers.leftAt,
      })
      .from(conversationMembers)
      .innerJoin(profiles, eq(profiles.userId, conversationMembers.userId))
      .where(eq(conversationMembers.conversationId, conversationId)),
    convo.startupId
      ? db.select({ id: startups.id, name: startups.name, slug: startups.slug, logoUrl: startups.logoUrl }).from(startups).where(eq(startups.id, convo.startupId)).limit(1)
      : Promise.resolve([]),
  ]);
  const startup = startupRow[0] ?? null;
  const members = everyone
    .filter((m) => !m.leftAt && m.userId !== viewerId)
    .map((m) => ({ userId: m.userId, name: m.name, handle: m.handle, avatarUrl: m.avatarUrl, headline: m.headline, lastReadAt: m.lastReadAt?.toISOString() ?? null }));
  const people: Record<string, PersonRef> = {};
  for (const m of everyone) people[m.userId] = { userId: m.userId, name: m.name, handle: m.handle, avatarUrl: m.avatarUrl };

  let blocked = false;
  if (convo.directKey) {
    const other = otherFromDirectKey(convo.directKey, viewerId);
    blocked = !!other && (await isBlockedEitherWay(viewerId, other));
  }
  const isGroup = convo.type === "startup_group" || members.length > 1;
  const subtitle = isGroup
    ? members.length === 0
      ? "Just you for now"
      : `${members.length + 1} members`
    : convo.type === "booking"
      ? "Booking thread"
      : convo.type === "consultant"
        ? "Consultant"
        : convo.type === "match"
          ? "Cofounder match"
          : (members[0]?.headline ?? null);
  return {
    id: convo.id,
    type: convo.type,
    title: conversationTitle(convo, startup, members),
    subtitle,
    startup,
    viewerId,
    muted: !!me.mutedAt,
    blocked,
    members,
    people,
  };
}

type MessageRow = typeof messages.$inferSelect;

function toMessageDTO(m: MessageRow, reactions: { messageId: string; emoji: string; userId: string }[]): MessageDTO {
  const deleted = !!m.deletedAt;
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    kind: m.kind,
    body: deleted ? "" : m.body,
    attachments: deleted ? null : (m.attachments ?? null),
    deleted,
    createdAt: m.createdAt.toISOString(),
    reactions: deleted ? [] : reactions.filter((r) => r.messageId === m.id).map((r) => ({ emoji: r.emoji, userId: r.userId })),
  };
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

/** JSON-ready page of messages. `hasMore` tells the client whether "Load earlier" is useful. */
export async function listMessagesDTO(
  conversationId: string,
  userId: string,
  opts: { before?: Date; after?: Date; limit?: number } = {},
): Promise<MessagesPageDTO> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const rows = await listMessages(conversationId, userId, { ...opts, limit: limit + 1 });
  const hasMore = rows.length > limit;
  const page = opts.after ? rows.slice(0, limit) : rows.slice(rows.length > limit ? 1 : 0);
  return {
    hasMore,
    messages: page.map((m) => toMessageDTO(m, m.reactions.map((r) => ({ ...r, messageId: m.id })))),
  };
}

export async function getMessageDTO(messageId: string): Promise<MessageDTO | null> {
  const [m] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!m) return null;
  const reactions = await db.select().from(messageReactions).where(eq(messageReactions.messageId, messageId));
  return toMessageDTO(m, reactions);
}

/** Typing, read receipts and recent reaction/deletion state, polled alongside new messages. */
export async function getConversationState(conversationId: string, viewerId: string): Promise<ConversationStateDTO> {
  await assertMember(conversationId, viewerId);
  const now = new Date();
  const [members, recentRows] = await Promise.all([
    db
      .select({ userId: conversationMembers.userId, lastReadAt: conversationMembers.lastReadAt, typingAt: conversationMembers.typingAt })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt))),
    db
      .select({ id: messages.id, deletedAt: messages.deletedAt })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(50),
  ]);
  const reactions = recentRows.length
    ? await db.select().from(messageReactions).where(inArray(messageReactions.messageId, recentRows.map((r) => r.id)))
    : [];
  return {
    serverTime: now.toISOString(),
    typing: members
      .filter((m) => m.userId !== viewerId && m.typingAt && now.getTime() - m.typingAt.getTime() < TYPING_TTL_MS)
      .map((m) => m.userId),
    reads: members.filter((m) => m.userId !== viewerId).map((m) => ({ userId: m.userId, lastReadAt: m.lastReadAt?.toISOString() ?? null })),
    recent: recentRows.map((r) => ({
      id: r.id,
      deleted: !!r.deletedAt,
      reactions: r.deletedAt ? [] : reactions.filter((x) => x.messageId === r.id).map((x) => ({ emoji: x.emoji, userId: x.userId })),
    })),
  };
}

export async function markConversationRead(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  await markNotificationsReadByHref(userId, `/messages/${conversationId}`);
  publishConversationEvent({ type: "conversation.read", conversationId, userId });
}

export async function setTyping(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  await db
    .update(conversationMembers)
    .set({ typingAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  publishConversationEvent({ type: "conversation.typing", conversationId, userId });
}

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  if (!(ALLOWED_REACTIONS as readonly string[]).includes(emoji)) throw new AppError("VALIDATION", "Unsupported reaction.");
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!msg) throw notFound("Message");
  await assertMember(msg.conversationId, userId);
  if (msg.deletedAt || msg.kind === "system") throw new AppError("VALIDATION", "You can't react to this message.");
  const where = and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId), eq(messageReactions.emoji, emoji));
  const [existing] = await db.select().from(messageReactions).where(where).limit(1);
  if (existing) await db.delete(messageReactions).where(where);
  else await db.insert(messageReactions).values({ messageId, userId, emoji }).onConflictDoNothing();
  publishConversationEvent({ type: "message.updated", conversationId: msg.conversationId, messageId });
  const reactions = await db.select().from(messageReactions).where(eq(messageReactions.messageId, messageId));
  return { reacted: !existing, reactions: reactions.map((r) => ({ emoji: r.emoji, userId: r.userId })) };
}

export async function deleteMessage(messageId: string, userId: string) {
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!msg) throw notFound("Message");
  await assertMember(msg.conversationId, userId);
  if (msg.senderId !== userId) throw forbidden("You can only delete your own messages.");
  if (msg.deletedAt) return;
  await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));
  await db.delete(messageReactions).where(eq(messageReactions.messageId, messageId));
  publishConversationEvent({ type: "message.updated", conversationId: msg.conversationId, messageId });
}

export async function setMuted(conversationId: string, userId: string, muted: boolean) {
  await assertMember(conversationId, userId);
  await db
    .update(conversationMembers)
    .set({ mutedAt: muted ? new Date() : null })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
}

export { toMessageDTO };
