/**
 * Realtime delivery abstraction.
 *
 * Default transport: **short polling**. Clients (`useConversationStream` in
 * `src/components/messaging/use-conversation-stream.ts`) poll
 *   GET /api/v1/conversations/:id/messages?after=<iso>   every 2.5s while the tab is visible
 *   GET /api/v1/conversations/:id/state                  typing, read receipts, reactions/deletes
 * so `publish()` is a no-op: the database *is* the channel.
 *
 * Pusher seam (not implemented — nothing is faked): to add push delivery,
 *  1. implement `RealtimeTransport` in `./pusher.ts` using PUSHER_APP_ID / PUSHER_KEY /
 *     PUSHER_SECRET / PUSHER_CLUSTER (add them to `server/env.ts` `features`),
 *     publishing to the channel names below (private channels, authorised by an
 *     `/api/v1/realtime/auth` route that calls `assertMember`),
 *  2. return it from `getRealtimeTransport()` when configured,
 *  3. have `clientConfig()` return `{ kind: "pusher", key, cluster }` so the hook subscribes
 *     and falls back to polling at a slower interval as a safety net.
 * Services already call `publish()` at every state change, so no call sites need to change.
 */

export type RealtimeEvent =
  | { type: "message.created"; conversationId: string; messageId: string }
  | { type: "message.updated"; conversationId: string; messageId: string }
  | { type: "conversation.read"; conversationId: string; userId: string }
  | { type: "conversation.typing"; conversationId: string; userId: string };

export type RealtimeClientConfig = { kind: "polling"; messagesIntervalMs: number; stateIntervalMs: number };

export interface RealtimeTransport {
  readonly kind: "polling" | "pusher";
  publish(channel: string, event: RealtimeEvent): Promise<void>;
  clientConfig(): RealtimeClientConfig;
}

export const conversationChannel = (conversationId: string) => `private-conversation-${conversationId}`;

export const POLL_INTERVAL_MS = 2500;
/** Members whose `typingAt` is newer than this are shown as typing. */
export const TYPING_TTL_MS = 6000;

const pollingTransport: RealtimeTransport = {
  kind: "polling",
  async publish() {
    // Clients poll the database-backed endpoints; nothing to push.
  },
  clientConfig() {
    return { kind: "polling", messagesIntervalMs: POLL_INTERVAL_MS, stateIntervalMs: POLL_INTERVAL_MS };
  },
};

export function getRealtimeTransport(): RealtimeTransport {
  return pollingTransport;
}

/** Fire-and-forget publish used by services; never lets a transport failure break a write. */
export function publishConversationEvent(event: RealtimeEvent) {
  void getRealtimeTransport()
    .publish(conversationChannel(event.conversationId), event)
    .catch(() => undefined);
}
