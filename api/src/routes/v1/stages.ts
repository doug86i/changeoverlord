import type { FastifyPluginAsync } from "fastify";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { events, stages } from "../../db/schema.js";

const stageCols = {
  id: stages.id,
  eventId: stages.eventId,
  name: stages.name,
  sortOrder: stages.sortOrder,
};
import {
  createStageBody,
  patchStageBody,
  eventIdParam,
  uuidParam,
} from "../../schemas/api.js";

export const stagesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events/:eventId/stages", async (req, reply) => {
    const { eventId } = eventIdParam.parse(req.params);
    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    if (!ev) return reply.code(404).send({ error: "NotFound" });
    const rows = await db
      .select(stageCols)
      .from(stages)
      .where(eq(stages.eventId, eventId))
      .orderBy(asc(stages.sortOrder), asc(stages.name));
    return { stages: rows };
  });

  app.post("/events/:eventId/stages", async (req, reply) => {
    const { eventId } = eventIdParam.parse(req.params);
    const body = createStageBody.parse(req.body);
    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    if (!ev) return reply.code(404).send({ error: "NotFound" });
    const [row] = await db
      .insert(stages)
      .values({
        eventId,
        name: body.name,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning(stageCols);
    return reply.code(201).send({ stage: row });
  });

  app.get("/stages/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db.select(stageCols).from(stages).where(eq(stages.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    return { stage: row };
  });

  app.patch("/stages/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = patchStageBody.parse(req.body);
    const [row] = await db
      .update(stages)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(eq(stages.id, id))
      .returning(stageCols);
    if (!row) return reply.code(404).send({ error: "NotFound" });
    return { stage: row };
  });

  app.delete("/stages/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const deleted = await db.delete(stages).where(eq(stages.id, id)).returning();
    if (deleted.length === 0) return reply.code(404).send({ error: "NotFound" });
    return reply.code(204).send();
  });
};
