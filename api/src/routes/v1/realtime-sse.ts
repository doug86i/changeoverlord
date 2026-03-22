import type { FastifyPluginAsync } from "fastify";
import {
  subscribeRealtime,
  type RealtimeMessageV1,
} from "../../lib/realtime-bus.js";
import { reserveSseSlot } from "../../lib/sse-ip-cap.js";

/**
 * Server-Sent Events stream: push invalidate hints so UIs refetch without refresh.
 * Same session cookie rules as other /api/v1 routes when a password is set.
 */
export const realtimeSseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/realtime", async (req, reply) => {
    const release = reserveSseSlot(req);
    if (!release) {
      return reply.code(429).send({ error: "TooManyConnections" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.flushHeaders?.();

    const safeWrite = (chunk: string) => {
      try {
        if (!reply.raw.writableEnded) reply.raw.write(chunk);
      } catch {
        /* client disconnected mid-write */
      }
    };

    const send = (msg: RealtimeMessageV1) => {
      safeWrite(`data: ${JSON.stringify(msg)}\n\n`);
    };

    const unsub = subscribeRealtime(send);

    const heartbeat = setInterval(() => {
      safeWrite(": ping\n\n");
    }, 25000);

    req.log.debug("sse realtime stream opened");

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      release();
      unsub();
      req.log.debug("sse realtime stream closed");
    });

    safeWrite(": connected\n\n");
  });
};
