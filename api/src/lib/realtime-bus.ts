import { EventEmitter } from "node:events";
import { createLogger } from "./log.js";

const busLog = createLogger("realtime-bus");

/** Optional instant payload for stage/event chat (see `docs/REALTIME.md`). */
export type RealtimeChatPushV1 = {
  id: string;
  eventId: string;
  stageId: string | null;
  scope: "stage" | "event";
  author: string;
  body: string;
  createdAt: string;
};

/** Wire format pushed over SSE; matches TanStack Query `queryKey` arrays. */
export type RealtimeMessageV1 = {
  v: 1;
  invalidate: (string | null)[][];
  chat?: RealtimeChatPushV1;
};

const bus = new EventEmitter();
bus.setMaxListeners(0);

function emitRealtime(msg: RealtimeMessageV1): void {
  if (msg.invalidate.length === 0 && !msg.chat) return;
  busLog.debug(
    { keys: msg.invalidate, hasChat: Boolean(msg.chat) },
    "broadcast realtime",
  );
  bus.emit("message", msg);
}

/** Notify all connected browsers to refetch matching queries. */
export function broadcastInvalidate(keys: (string | null)[][]): void {
  if (keys.length === 0) return;
  emitRealtime({ v: 1, invalidate: keys });
}

/** Invalidate chat queries and push one message for immediate UI (dock open/flash). */
export function broadcastChatMessage(
  keys: (string | null)[][],
  chat: RealtimeChatPushV1,
): void {
  emitRealtime({ v: 1, invalidate: keys, chat });
}

export function subscribeRealtime(
  handler: (msg: RealtimeMessageV1) => void,
): () => void {
  bus.on("message", handler);
  return () => {
    bus.off("message", handler);
  };
}
