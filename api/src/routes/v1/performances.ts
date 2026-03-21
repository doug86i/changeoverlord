import type { FastifyPluginAsync } from "fastify";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { stageDays, performances } from "../../db/schema.js";
import {
  createPerformanceBody,
  patchPerformanceBody,
  stageDayIdParam,
  uuidParam,
} from "../../schemas/api.js";

export const performancesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stage-days/:stageDayId/performances", async (req, reply) => {
    const { stageDayId } = stageDayIdParam.parse(req.params);
    const [day] = await db
      .select()
      .from(stageDays)
      .where(eq(stageDays.id, stageDayId));
    if (!day) return reply.code(404).send({ error: "NotFound" });
    const rows = await db
      .select()
      .from(performances)
      .where(eq(performances.stageDayId, stageDayId))
      .orderBy(asc(performances.sortOrder), asc(performances.startTime));
    return { performances: rows };
  });

  app.post("/stage-days/:stageDayId/performances", async (req, reply) => {
    const { stageDayId } = stageDayIdParam.parse(req.params);
    const body = createPerformanceBody.parse(req.body);
    const [day] = await db
      .select()
      .from(stageDays)
      .where(eq(stageDays.id, stageDayId));
    if (!day) return reply.code(404).send({ error: "NotFound" });
    const [row] = await db
      .insert(performances)
      .values({
        stageDayId,
        bandName: body.bandName,
        notes: body.notes ?? "",
        startTime: body.startTime,
        endTime: body.endTime ?? null,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();
    return reply.code(201).send({ performance: row });
  });

  app.get("/performances/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    return { performance: row };
  });

  app.patch("/performances/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = patchPerformanceBody.parse(req.body);
    const [row] = await db
      .update(performances)
      .set({
        ...(body.bandName !== undefined ? { bandName: body.bandName } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body.endTime !== undefined
          ? { endTime: body.endTime }
          : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(eq(performances.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "NotFound" });
    return { performance: row };
  });

  app.delete("/performances/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const deleted = await db
      .delete(performances)
      .where(eq(performances.id, id))
      .returning();
    if (deleted.length === 0) return reply.code(404).send({ error: "NotFound" });
    return reply.code(204).send();
  });
};
