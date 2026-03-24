import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { normalizePerformancesOrderForStageDay } from "../../lib/performance-sort-order.js";
import {
  events,
  performanceWorkbooks,
  performances,
  stages,
  stageDays,
} from "../../db/schema.js";
import {
  createStageDayBody,
  duplicateStageDayScheduleBody,
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
        ["allStagesForClock"],
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
    const [ctx] = await db
      .select({ eventLogoFileId: events.logoFileId })
      .from(stages)
      .innerJoin(events, eq(stages.eventId, events.id))
      .where(eq(stages.id, row.stageId))
      .limit(1);
    return {
      stageDay: row,
      eventLogoFileId: ctx?.eventLogoFileId ?? null,
    };
  });

  app.post("/stage-days/:id/duplicate-schedule", async (req, reply) => {
    const { id: sourceId } = uuidParam.parse(req.params);
    const body = duplicateStageDayScheduleBody.parse(req.body);

    const [source] = await db.select().from(stageDays).where(eq(stageDays.id, sourceId));
    const [target] = await db
      .select()
      .from(stageDays)
      .where(eq(stageDays.id, body.targetStageDayId));
    if (!source || !target) return reply.code(404).send({ error: "NotFound" });
    if (source.stageId !== target.stageId) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "Source and target days must belong to the same stage",
      });
    }

    const existingTarget = await db
      .select({ id: performances.id })
      .from(performances)
      .where(eq(performances.stageDayId, body.targetStageDayId));

    if (existingTarget.length > 0 && !body.replaceExisting) {
      return reply.code(409).send({
        error: "Conflict",
        message:
          "Target day already has performances. Send replaceExisting: true to replace its schedule.",
      });
    }

    const sourcePerfs = await db
      .select()
      .from(performances)
      .where(eq(performances.stageDayId, sourceId))
      .orderBy(asc(performances.sortOrder), asc(performances.startTime), asc(performances.id));

    const newPerfIds = await db.transaction(async (tx) => {
      if (body.replaceExisting && existingTarget.length > 0) {
        const ids = existingTarget.map((p) => p.id);
        await tx.delete(performances).where(inArray(performances.id, ids));
      }
      const created: string[] = [];
      for (const sp of sourcePerfs) {
        const newId = randomUUID();
        await tx.insert(performances).values({
          id: newId,
          stageDayId: body.targetStageDayId,
          sortOrder: sp.sortOrder,
          bandName: sp.bandName,
          notes: sp.notes,
          startTime: sp.startTime,
          endTime: sp.endTime,
        });
        const [wb] = await tx
          .select({ sheetsJson: performanceWorkbooks.sheetsJson })
          .from(performanceWorkbooks)
          .where(eq(performanceWorkbooks.performanceId, sp.id))
          .limit(1);
        if (wb && Array.isArray(wb.sheetsJson) && wb.sheetsJson.length > 0) {
          const copy = structuredClone(wb.sheetsJson) as unknown[];
          await tx.insert(performanceWorkbooks).values({
            performanceId: newId,
            sheetsJson: copy,
            updatedAt: new Date(),
          });
        }
        created.push(newId);
      }
      return created;
    });

    if (newPerfIds.length > 0) {
      await normalizePerformancesOrderForStageDay(body.targetStageDayId);
    }

    const keys: (string | null)[][] = [
      ["performances", body.targetStageDayId],
      ["stageDay", body.targetStageDayId],
      ["stageDays", target.stageId],
      ["stage", target.stageId],
      ["allStagesForClock"],
    ];
    for (const pid of newPerfIds) keys.push(["performance", pid]);
    broadcastInvalidate(keys);
    req.log.debug(
      { sourceStageDayId: sourceId, targetStageDayId: body.targetStageDayId, count: newPerfIds.length },
      "stage day schedule duplicated",
    );
    return { performanceIds: newPerfIds };
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
        ["allStagesForClock"],
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
      ["allStagesForClock"],
    ]);
    req.log.debug({ stageDayId: id }, "stage day deleted");
    return reply.code(204).send();
  });
};
