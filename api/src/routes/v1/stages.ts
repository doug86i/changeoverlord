import type { FastifyPluginAsync } from "fastify";
import { eq, asc, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { events, patchTemplates, stageDays, stages } from "../../db/schema.js";
import {
  createStageBody,
  patchStageBody,
  eventIdParam,
  uuidParam,
} from "../../schemas/api.js";

const stageCols = {
  id: stages.id,
  eventId: stages.eventId,
  name: stages.name,
  sortOrder: stages.sortOrder,
  defaultPatchTemplateId: stages.defaultPatchTemplateId,
};

const stageColsWithTemplate = {
  ...stageCols,
  hasPatchTemplate: sql<boolean>`(${stages.defaultPatchTemplateId} IS NOT NULL)`,
};

export const stagesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events/:eventId/stages", async (req, reply) => {
    const { eventId } = eventIdParam.parse(req.params);
    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    if (!ev) return reply.code(404).send({ error: "NotFound" });
    const rows = await db
      .select(stageColsWithTemplate)
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
        defaultPatchTemplateId: null,
      })
      .returning(stageCols);
    broadcastInvalidate([["stages", eventId], ["stage", row.id]]);
    req.log.debug({ stageId: row.id, eventId }, "stage created");
    return reply.code(201).send({ stage: row });
  });

  app.get("/stages/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db
      .select(stageColsWithTemplate)
      .from(stages)
      .where(eq(stages.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    return { stage: row };
  });

  app.patch("/stages/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = patchStageBody.parse(req.body);
    if (body.defaultPatchTemplateId !== undefined && body.defaultPatchTemplateId !== null) {
      const [t] = await db
        .select({ id: patchTemplates.id })
        .from(patchTemplates)
        .where(eq(patchTemplates.id, body.defaultPatchTemplateId))
        .limit(1);
      if (!t) {
        return reply.code(400).send({
          error: "ValidationError",
          message: "Unknown patch template",
        });
      }
    }
    const [row] = await db
      .update(stages)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.defaultPatchTemplateId !== undefined
          ? { defaultPatchTemplateId: body.defaultPatchTemplateId }
          : {}),
      })
      .where(eq(stages.id, id))
      .returning(stageCols);
    if (!row) return reply.code(404).send({ error: "NotFound" });
    broadcastInvalidate([
      ["stages", row.eventId],
      ["stage", id],
      ["patchTemplates"],
      ["events"],
    ]);
    req.log.debug({ stageId: id }, "stage updated");
    return { stage: row };
  });

  app.delete("/stages/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [existing] = await db.select().from(stages).where(eq(stages.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    const days = await db
      .select({ id: stageDays.id })
      .from(stageDays)
      .where(eq(stageDays.stageId, id));

    await db.delete(stages).where(eq(stages.id, id));

    const keys: (string | null)[][] = [
      ["stages", existing.eventId],
      ["stage", id],
      ["stageDays", id],
    ];
    for (const d of days) {
      keys.push(["stageDay", d.id], ["performances", d.id]);
    }
    broadcastInvalidate(keys);
    req.log.debug({ stageId: id }, "stage deleted");
    return reply.code(204).send();
  });
};
