import websocket from "@fastify/websocket";
import { setupWSConnection, setPersistence } from "@y/websocket-server/utils";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { performances, patchTemplates } from "../db/schema.js";
import { createYjsPersistence } from "../lib/yjs-persistence.js";
import { createLogger } from "../lib/log.js";

const WS_MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

const wsLog = createLogger("collab-ws");

type CollabParams = { Params: { performanceId: string } };
type TemplateCollabParams = { Params: { templateId: string } };

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const collabWsPlugin: FastifyPluginAsync = async (app) => {
  setPersistence(createYjsPersistence());

  await app.register(websocket, {
    options: { maxPayload: WS_MAX_PAYLOAD_BYTES },
  });

  app.get<CollabParams>(
    "/ws/v1/collab/:performanceId",
    { websocket: true },
    async (socket, req: FastifyRequest<CollabParams>) => {
      const id = req.params.performanceId;
      if (!id || !uuidRe.test(id)) {
        wsLog.warn({ performanceId: id }, "reject: invalid performance id");
        socket.close(1008, "Invalid performance id");
        return;
      }
      const [perf] = await db
        .select({ id: performances.id })
        .from(performances)
        .where(eq(performances.id, id))
        .limit(1);
      if (!perf) {
        wsLog.warn({ performanceId: id }, "reject: performance not found");
        socket.close(1008, "Performance not found");
        return;
      }
      wsLog.debug({ performanceId: id }, "websocket connection");
      socket.on("close", (code: number, reason: Buffer) => {
        wsLog.debug(
          { performanceId: id, code, reason: reason.toString() },
          "websocket closed",
        );
      });
      const docName = `ws/v1/collab/${id}`;
      try {
        setupWSConnection(socket, req.raw, { docName, gc: true });
      } catch (err) {
        wsLog.error(
          { err, performanceId: id, docName },
          "setupWSConnection failed (check Yjs / @y/protocols versions)",
        );
        socket.close(1011, "Yjs setup failed");
      }
    },
  );

  app.get<TemplateCollabParams>(
    "/ws/v1/collab-template/:templateId",
    { websocket: true },
    async (socket, req: FastifyRequest<TemplateCollabParams>) => {
      const id = req.params.templateId;
      if (!id || !uuidRe.test(id)) {
        wsLog.warn({ templateId: id }, "reject: invalid template id");
        socket.close(1008, "Invalid template id");
        return;
      }
      const [tpl] = await db
        .select({ id: patchTemplates.id })
        .from(patchTemplates)
        .where(eq(patchTemplates.id, id))
        .limit(1);
      if (!tpl) {
        wsLog.warn({ templateId: id }, "reject: template not found");
        socket.close(1008, "Template not found");
        return;
      }
      wsLog.debug({ templateId: id }, "template collab websocket");
      socket.on("close", (code: number, reason: Buffer) => {
        wsLog.debug(
          { templateId: id, code, reason: reason.toString() },
          "template websocket closed",
        );
      });
      const docName = `ws/v1/collab-template/${id}`;
      try {
        setupWSConnection(socket, req.raw, { docName, gc: true });
      } catch (err) {
        wsLog.error(
          { err, templateId: id, docName },
          "setupWSConnection failed (check Yjs / @y/protocols versions)",
        );
        socket.close(1011, "Yjs setup failed");
      }
    },
  );
};
