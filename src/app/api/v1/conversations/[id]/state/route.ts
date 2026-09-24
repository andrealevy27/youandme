import { apiRoute } from "@/server/messaging/http";
import { getConversationState } from "@/server/messaging";

/** GET → `ConversationStateDTO` (typing user ids, read receipts, recent reactions/deletions). */
export const GET = apiRoute<{ id: string }>(async ({ viewer, params }) => getConversationState(params.id, viewer.userId));
