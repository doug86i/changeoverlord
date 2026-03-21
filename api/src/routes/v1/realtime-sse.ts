import type { FastifyPluginAsync } from "fastify";
import {
  subscribeRealtime,
  type RealtimeMessageV1,
} from "../../lib/realtime-bus.js";

/**
 * Server-Sent Events stream: push invalidate hints so UIs refetch without refresh.
 * Same session cookie rules as other /api/v1 routes when a password is set.
 */
export const realtimeSseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/realtime", async (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.flushHeaders?.();

    const send = (msg: RealtimeMessageV1) => {
      reply.raw.write(`data: ${JSON.stringify(msg)}\n\n`);
    };

    const unsub = subscribeRealtime(send);

    const heartbeat = setInterval(() => {
      reply.raw.write(": ping\n\n");
    }, 25000);

    req.log.debug("sse realtime stream opened");

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsub();
      req.log.debug("sse realtime stream closed");
    });

    reply.raw.write(": connected\n\n");
  });
};
