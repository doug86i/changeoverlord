import type { FastifyPluginAsync } from "fastify";
import { and, asc, eq, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { events, stageChatMessages, stages } from "../../db/schema.js";
import { getChatPresence, touchChatPresence } from "../../lib/chat-presence.js";
import { broadcastChatMessage } from "../../lib/realtime-bus.js";
import {
  chatMessagesQuery,
  chatPresenceQuery,
  postChatMessageBody,
  postChatPresenceBody,
} from "../../schemas/api.js";

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get("/chat/presence", async (req, reply) => {
    const q = chatPresenceQuery.parse(req.query);
    const [ev] = await db.select().from(events).where(eq(events.id, q.eventId));
    if (!ev) return reply.code(404).send({ error: "NotFound" });
    return { online: getChatPresence(q.eventId) };
  });

  app.post("/chat/presence", async (req, reply) => {
    const body = postChatPresenceBody.parse(req.body);
    const [ev] = await db
      .select()
      .from(events)
      .where(eq(events.id, body.eventId));
    if (!ev) return reply.code(404).send({ error: "NotFound" });
    touchChatPresence(body.eventId, body.clientId, body.displayName);
    req.log.debug(
      { eventId: body.eventId, clientId: body.clientId },
      "chat presence heartbeat",
    );
    return reply.code(204).send();
  });

  app.get("/chat/messages", async (req, reply) => {
    const q = chatMessagesQuery.parse(req.query);
    const [ev] = await db.select().from(events).where(eq(events.id, q.eventId));
    if (!ev) return reply.code(404).send({ error: "NotFound" });
    const [st] = await db.select().from(stages).where(eq(stages.id, q.stageId));
    if (!st || st.eventId !== q.eventId) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "stageId must belong to eventId",
      });
    }

    const rows = await db
      .select()
      .from(stageChatMessages)
      .where(
        and(
          eq(stageChatMessages.eventId, q.eventId),
          or(
            eq(stageChatMessages.scope, "event"),
            and(
              eq(stageChatMessages.scope, "stage"),
              eq(stageChatMessages.stageId, q.stageId),
            ),
          ),
        ),
      )
      .orderBy(asc(stageChatMessages.createdAt))
      .limit(300);

    return {
      chatMessages: rows.map((r) => ({
        id: r.id,
        eventId: r.eventId,
        stageId: r.stageId,
        scope: r.scope,
        author: r.author,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.post("/chat/messages", async (req, reply) => {
    const body = postChatMessageBody.parse(req.body);
    const [ev] = await db
      .select()
      .from(events)
      .where(eq(events.id, body.eventId));
    if (!ev) return reply.code(404).send({ error: "NotFound" });

    let stageIdForRow: string | null = null;
    if (body.scope === "stage") {
      const sid = body.stageId!;
      const [st] = await db.select().from(stages).where(eq(stages.id, sid));
      if (!st || st.eventId !== body.eventId) {
        return reply.code(400).send({
          error: "ValidationError",
          message: "stageId must belong to eventId",
        });
      }
      stageIdForRow = sid;
    }

    const [row] = await db
      .insert(stageChatMessages)
      .values({
        eventId: body.eventId,
        stageId: stageIdForRow,
        scope: body.scope,
        author: body.author.trim() || "",
        body: body.body.trim(),
      })
      .returning();

    if (!row) {
      return reply.code(500).send({ error: "ServerError" });
    }

    broadcastChatMessage(
      [["chatMessages", body.eventId]],
      {
        id: row.id,
        eventId: row.eventId,
        stageId: row.stageId,
        scope: row.scope as "stage" | "event",
        author: row.author,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      },
    );
    req.log.debug(
      { chatMessageId: row.id, eventId: row.eventId, scope: row.scope },
      "chat message created",
    );
    return reply.code(201).send({
      chatMessage: {
        id: row.id,
        eventId: row.eventId,
        stageId: row.stageId,
        scope: row.scope,
        author: row.author,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      },
    });
  });
};
