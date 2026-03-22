import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "../api/client";
import { logDebug } from "../lib/debug";
import { useConnectionState } from "./ConnectionContext";
import {
  dispatchChatPush,
  type RealtimeChatPushV1,
} from "./chatPush";

type RealtimeMessageV1 = {
  v: 1;
  invalidate: (string | null)[][];
  chat?: RealtimeChatPushV1;
};

/**
 * Subscribes to `GET /api/v1/realtime` (SSE). When the server broadcasts
 * invalidate hints after REST mutations, matching TanStack Query caches refetch.
 * Opens only when the session can call the API (open LAN or logged in with password).
 * Pushes connection state into ConnectionContext for the header indicator.
 */
export function RealtimeSync() {
  const qc = useQueryClient();
  const { setState } = useConnectionState();
  const sessionQ = useQuery({
    queryKey: ["authSession"],
    queryFn: () =>
      apiGet<{ authenticated: boolean; passwordRequired: boolean }>(
        "/api/v1/auth/session",
      ),
  });

  const canStream = Boolean(
    sessionQ.data &&
      (!sessionQ.data.passwordRequired || sessionQ.data.authenticated),
  );

  useEffect(() => {
    if (!canStream) return;
    const es = new EventSource("/api/v1/realtime");
    logDebug("realtime", "EventSource connected");

    es.onopen = () => {
      logDebug("realtime", "EventSource open");
      setState("connected");
    };
    es.onmessage = (ev: MessageEvent<string>) => {
      setState("connected");
      try {
        const msg = JSON.parse(ev.data) as RealtimeMessageV1;
        if (msg.v !== 1 || !Array.isArray(msg.invalidate)) return;
        logDebug("realtime", "invalidate", msg.invalidate);
        for (const key of msg.invalidate) {
          void qc.invalidateQueries({ queryKey: key });
        }
        if (msg.chat) {
          logDebug("realtime", "chat push", msg.chat.id);
          dispatchChatPush(msg.chat);
        }
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      logDebug("realtime", "EventSource error / reconnecting");
      setState(es.readyState === EventSource.CLOSED ? "offline" : "connecting");
    };
    return () => {
      logDebug("realtime", "EventSource closed");
      es.close();
    };
  }, [qc, canStream, setState]);
  return null;
}
