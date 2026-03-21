import type { FastifyPluginAsync } from "fastify";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { stages, stageDays } from "../../db/schema.js";
import {
  createStageDayBody,
  patchStageDayBody,
  stageIdParam,
  uuidParam,
} from "../../schemas/api.js";

export const stageDaysRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stages/:stageId/days", async (req, reply) => {
    const { stageId } = stageIdParam.parse(req.params);
    const [st] = await db.select().from(stages).where(eq(stages.id, stageId));
    if (!st) return reply.code(404).send({ error: "NotFound" });
    const rows = await db
      .select()
      .from(stageDays)
      .where(eq(stageDays.stageId, stageId))
      .orderBy(asc(stageDays.dayDate), asc(stageDays.sortOrder));
    return { stageDays: rows };
  });

  app.post("/stages/:stageId/days", async (req, reply) => {
    const { stageId } = stageIdParam.parse(req.params);
    const body = createStageDayBody.parse(req.body);
    const [st] = await db.select().from(stages).where(eq(stages.id, stageId));
    if (!st) return reply.code(404).send({ error: "NotFound" });
    try {
      const [row] = await db
        .insert(stageDays)
        .values({
          stageId,
          dayDate: body.dayDate,
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();
      broadcastInvalidate([
        ["stageDays", stageId],
        ["stage", stageId],
        ["stageDay", row.id],
      ]);
      req.log.debug({ stageDayId: row.id, stageId }, "stage day created");
      return reply.code(201).send({ stageDay: row });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        req.log.debug({ stageId }, "stage day create conflict");
        return reply.code(409).send({
          error: "Conflict",
          message: "A day with this date already exists for this stage",
        });
      }
      throw e;
    }
  });

  app.get("/stage-days/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db.select().from(stageDays).where(eq(stageDays.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    return { stageDay: row };
  });

  app.patch("/stage-days/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = patchStageDayBody.parse(req.body);
    try {
      const [row] = await db
        .update(stageDays)
        .set({
          ...(body.dayDate !== undefined ? { dayDate: body.dayDate } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        })
        .where(eq(stageDays.id, id))
        .returning();
      if (!row) return reply.code(404).send({ error: "NotFound" });
      broadcastInvalidate([
        ["stageDay", id],
        ["stageDays", row.stageId],
        ["stage", row.stageId],
        ["performances", id],
      ]);
      req.log.debug({ stageDayId: id }, "stage day updated");
      return { stageDay: row };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        req.log.debug({ stageDayId: id }, "stage day update conflict");
        return reply.code(409).send({
          error: "Conflict",
          message: "A day with this date already exists for this stage",
        });
      }
      throw e;
    }
  });

  app.delete("/stage-days/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [existing] = await db.select().from(stageDays).where(eq(stageDays.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    await db.delete(stageDays).where(eq(stageDays.id, id));

    broadcastInvalidate([
      ["stageDay", id],
      ["stageDays", existing.stageId],
      ["stage", existing.stageId],
      ["performances", id],
    ]);
    req.log.debug({ stageDayId: id }, "stage day deleted");
    return reply.code(204).send();
  });
};
