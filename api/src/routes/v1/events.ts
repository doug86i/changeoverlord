import type { FastifyPluginAsync } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { events } from "../../db/schema.js";
import {
  createEventBody,
  patchEventBody,
  uuidParam,
} from "../../schemas/api.js";

export const eventsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events", async () => {
    const rows = await db
      .select()
      .from(events)
      .orderBy(desc(events.createdAt));
    return { events: rows };
  });

  app.post("/events", async (req, reply) => {
    const body = createEventBody.parse(req.body);
    if (body.endDate < body.startDate) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "endDate must be on or after startDate",
      });
    }
    const [row] = await db
      .insert(events)
      .values({
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
      })
      .returning();
    return reply.code(201).send({ event: row });
  });

  app.get("/events/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db.select().from(events).where(eq(events.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    return { event: row };
  });

  app.patch("/events/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = patchEventBody.parse(req.body);
    const [existing] = await db.select().from(events).where(eq(events.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });
    const start = body.startDate ?? existing.startDate;
    const end = body.endDate ?? existing.endDate;
    if (end < start) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "endDate must be on or after startDate",
      });
    }
    const [row] = await db
      .update(events)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
        ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
      })
      .where(eq(events.id, id))
      .returning();
    return { event: row };
  });

  app.delete("/events/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const deleted = await db.delete(events).where(eq(events.id, id)).returning();
    if (deleted.length === 0) return reply.code(404).send({ error: "NotFound" });
    return reply.code(204).send();
  });
};
