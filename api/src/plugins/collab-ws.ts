import websocket from "@fastify/websocket";
import { setupWSConnection, setPersistence } from "@y/websocket-server/utils";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { createYjsPersistence } from "../lib/yjs-persistence.js";
import { createLogger } from "../lib/log.js";

const wsLog = createLogger("collab-ws");

type CollabParams = { Params: { performanceId: string } };
type TemplateCollabParams = { Params: { templateId: string } };

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const collabWsPlugin: FastifyPluginAsync = async (app) => {
  setPersistence(createYjsPersistence());

  await app.register(websocket);

  app.get<CollabParams>(
    "/ws/v1/collab/:performanceId",
    { websocket: true },
    (socket, req: FastifyRequest<CollabParams>) => {
      const id = req.params.performanceId;
      if (!id || !uuidRe.test(id)) {
        wsLog.warn({ performanceId: id }, "reject: invalid performance id");
        socket.close(1008, "Invalid performance id");
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
    (socket, req: FastifyRequest<TemplateCollabParams>) => {
      const id = req.params.templateId;
      if (!id || !uuidRe.test(id)) {
        wsLog.warn({ templateId: id }, "reject: invalid template id");
        socket.close(1008, "Invalid template id");
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
