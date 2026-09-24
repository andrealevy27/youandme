/**
 * Wire contract for messaging, shared by the server serializers, the JSON API
 * (`/api/v1/conversations/**`) and the client components. Plain types only —
 * safe to import from both server and client code. Dates are ISO strings.
 */

export type ConversationKind = "direct" | "match" | "consultant" | "startup_group" | "booking";
export type InboxFilter = "all" | "matches" | "consultants" | "startups" | "direct";
export type MessageKind = "text" | "image" | "file" | "system";

export type AttachmentDTO = { url: string; name: string; size: number; mime: string };
export type ReactionDTO = { emoji: string; userId: string };

export type MessageDTO = {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: MessageKind;
  body: string;
  attachments: AttachmentDTO[] | null;
  deleted: boolean;
  createdAt: string;
  reactions: ReactionDTO[];
};

export type PersonRef = { userId: string; name: string; handle: string; avatarUrl: string | null };

export type ThreadMemberDTO = PersonRef & { headline: string | null; lastReadAt: string | null };

export type ThreadDTO = {
  id: string;
  type: ConversationKind;
  title: string;
  subtitle: string | null;
  startup: { id: string; name: string; slug: string; logoUrl: string | null } | null;
  viewerId: string;
  muted: boolean;
  /** Direct thread where either person blocked the other — read-only. */
  blocked: boolean;
  /** Current members, excluding the viewer. */
  members: ThreadMemberDTO[];
  /** Everyone who ever posted or belonged (for sender names on older messages). */
  people: Record<string, PersonRef>;
};

export type ConversationStateDTO = {
  serverTime: string;
  typing: string[];
  reads: { userId: string; lastReadAt: string | null }[];
  /** Reactions / deletion flags for the most recent messages, so edits propagate while polling. */
  recent: { id: string; deleted: boolean; reactions: ReactionDTO[] }[];
};

export type InboxItemDTO = {
  id: string;
  type: ConversationKind;
  filter: Exclude<InboxFilter, "all">;
  title: string;
  avatars: { name: string; avatarUrl: string | null }[];
  lastMessage: { preview: string; fromViewer: boolean; createdAt: string } | null;
  lastMessageAt: string;
  unread: number;
  muted: boolean;
};

export type MessagesPageDTO = { messages: MessageDTO[]; hasMore: boolean };
