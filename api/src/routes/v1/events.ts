import type { FastifyPluginAsync } from "fastify";
import { count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { events, stageDays, stages } from "../../db/schema.js";
import {
  createEventBody,
  patchEventBody,
  uuidParam,
} from "../../schemas/api.js";

const eventsListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const eventsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events", async (req) => {
    const { page, limit } = eventsListQuery.parse(req.query);
    const offset = (page - 1) * limit;
    const [countRow] = await db.select({ total: count() }).from(events);
    const total = Number(countRow?.total ?? 0);
    const rows = await db
      .select()
      .from(events)
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset);
    const hasMore = offset + rows.length < total;
    return { events: rows, total, page, limit, hasMore };
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
    broadcastInvalidate([["events"], ["allStagesForClock"]]);
    req.log.debug({ eventId: row.id }, "event created");
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
    broadcastInvalidate([["events"], ["event", id], ["allStagesForClock"]]);
    req.log.debug({ eventId: id }, "event updated");
    return { event: row };
  });

  app.delete("/events/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [ev] = await db.select().from(events).where(eq(events.id, id));
    if (!ev) return reply.code(404).send({ error: "NotFound" });

    const stRows = await db
      .select({ id: stages.id })
      .from(stages)
      .where(eq(stages.eventId, id));
    const stageIds = stRows.map((s) => s.id);
    const dayRows =
      stageIds.length > 0
        ? await db
            .select({ id: stageDays.id })
            .from(stageDays)
            .where(inArray(stageDays.stageId, stageIds))
        : [];
    const dayIds = dayRows.map((d) => d.id);

    await db.delete(events).where(eq(events.id, id));

    const keys: (string | null)[][] = [
      ["events"],
      ["event", id],
      ["stages", id],
      ["allStagesForClock"],
    ];
    for (const s of stRows) {
      keys.push(["stage", s.id], ["stageDays", s.id]);
    }
    for (const did of dayIds) {
      keys.push(["stageDay", did], ["performances", did]);
    }
    broadcastInvalidate(keys);
    req.log.debug({ eventId: id }, "event deleted");
    return reply.code(204).send();
  });
};
