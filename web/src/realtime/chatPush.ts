/** Matches optional `chat` field on SSE `RealtimeMessageV1` (see `docs/REALTIME.md`). */
export type RealtimeChatPushV1 = {
  id: string;
  eventId: string;
  stageId: string | null;
  scope: "stage" | "event";
  author: string;
  body: string;
  createdAt: string;
};

type Handler = (msg: RealtimeChatPushV1) => void;

let handler: Handler | null = null;

export function setChatPushHandler(fn: Handler | null): void {
  handler = fn;
}

export function dispatchChatPush(msg: RealtimeChatPushV1): void {
  handler?.(msg);
}
