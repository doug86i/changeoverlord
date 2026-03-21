import { EventEmitter } from "node:events";
import { createLogger } from "./log.js";

const busLog = createLogger("realtime-bus");

/** Wire format pushed over SSE; matches TanStack Query `queryKey` arrays. */
export type RealtimeMessageV1 = {
  v: 1;
  invalidate: (string | null)[][];
};

const bus = new EventEmitter();
bus.setMaxListeners(0);

/** Notify all connected browsers to refetch matching queries. */
export function broadcastInvalidate(keys: (string | null)[][]): void {
  if (keys.length === 0) return;
  const msg: RealtimeMessageV1 = { v: 1, invalidate: keys };
  busLog.debug({ keys }, "broadcast invalidate");
  bus.emit("message", msg);
}

export function subscribeRealtime(
  handler: (msg: RealtimeMessageV1) => void,
): () => void {
  bus.on("message", handler);
  return () => {
    bus.off("message", handler);
  };
}
