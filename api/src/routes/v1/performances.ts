import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { Sheet } from "@fortune-sheet/core";
import { eq, asc, gte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { decodeTemplateSnapshotToSheets } from "../../lib/yjs-template-snapshot.js";
import { validatePerformanceSchedule, hhmmToMinutes } from "../../lib/performance-overlap.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import {
  performanceYjsSnapshots,
  patchTemplates,
  stageDays,
  performances,
  stages,
} from "../../db/schema.js";
import {
  createPerformanceBody,
  patchPerformanceBody,
  stageDayIdParam,
  uuidParam,
} from "../../schemas/api.js";
import { z } from "zod";

function addMinutes(hhmm: string, delta: number): string {
  let total = hhmmToMinutes(hhmm) + delta;
  total = Math.max(0, Math.min(24 * 60 - 1, total));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

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
      .orderBy(asc(performances.startTime), asc(performances.id));
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

    const existing = await db
      .select({
        id: performances.id,
        startTime: performances.startTime,
        endTime: performances.endTime,
      })
      .from(performances)
      .where(eq(performances.stageDayId, stageDayId));

    const newId = randomUUID();
    const trial = [
      ...existing.map((p) => ({
        id: p.id,
        startTime: p.startTime,
        endTime: p.endTime,
      })),
      {
        id: newId,
        startTime: body.startTime,
        endTime: body.endTime ?? null,
      },
    ];
    const scheduleErr = validatePerformanceSchedule(trial);
    if (scheduleErr) {
      return reply.code(400).send({
        error: "ValidationError",
        message: scheduleErr,
      });
    }

    const [row] = await db
      .insert(performances)
      .values({
        id: newId,
        stageDayId,
        bandName: body.bandName,
        notes: body.notes ?? "",
        startTime: body.startTime,
        endTime: body.endTime ?? null,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();

    const [seed] = await db
      .select({ snapshot: patchTemplates.snapshot })
      .from(stages)
      .leftJoin(
        patchTemplates,
        eq(stages.defaultPatchTemplateId, patchTemplates.id),
      )
      .where(eq(stages.id, day.stageId))
      .limit(1);
    if (seed?.snapshot?.length) {
      await db
        .insert(performanceYjsSnapshots)
        .values({
          performanceId: row.id,
          snapshot: seed.snapshot,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: performanceYjsSnapshots.performanceId,
          set: {
            snapshot: seed.snapshot,
            updatedAt: new Date(),
          },
        });
    }

    broadcastInvalidate([
      ["performances", stageDayId],
      ["performance", row.id],
    ]);
    req.log.debug(
      {
        performanceId: row.id,
        stageDayId,
        seededYjs: Boolean(seed?.snapshot?.length),
      },
      "performance created",
    );
    return reply.code(201).send({ performance: row });
  });

  app.get("/performances/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    const [snap] = await db
      .select({ snapshot: performanceYjsSnapshots.snapshot })
      .from(performanceYjsSnapshots)
      .where(eq(performanceYjsSnapshots.performanceId, id))
      .limit(1);
    let initialSheets: Sheet[] = [];
    if (snap?.snapshot?.length) {
      initialSheets = decodeTemplateSnapshotToSheets(Buffer.from(snap.snapshot));
    }
    return { performance: row, initialSheets };
  });

  app.patch("/performances/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = patchPerformanceBody.parse(req.body);
    const [before] = await db.select().from(performances).where(eq(performances.id, id));
    if (!before) return reply.code(404).send({ error: "NotFound" });

    if (body.startTime || body.endTime !== undefined) {
      const mergedStart = body.startTime ?? before.startTime;
      const mergedEnd =
        body.endTime !== undefined ? body.endTime : before.endTime;
      if (
        mergedEnd !== null &&
        hhmmToMinutes(mergedEnd) <= hhmmToMinutes(mergedStart)
      ) {
        return reply.code(400).send({
          error: "ValidationError",
          message: "End time must be after start time",
        });
      }
    }

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
    broadcastInvalidate([
      ["performances", row.stageDayId],
      ["performance", id],
    ]);
    req.log.debug({ performanceId: id }, "performance updated");
    return { performance: row };
  });

  /** Swap band details (name + notes) between two performances on the same day. */
  app.post("/performances/:id/swap", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const { targetId } = z
      .object({ targetId: z.string().uuid() })
      .parse(req.body);

    const [a] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, id));
    const [b] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, targetId));
    if (!a || !b) return reply.code(404).send({ error: "NotFound" });
    if (a.stageDayId !== b.stageDayId) {
      return reply
        .code(400)
        .send({ error: "Can only swap performances on the same day" });
    }

    await db
      .update(performances)
      .set({ bandName: b.bandName, notes: b.notes })
      .where(eq(performances.id, id));
    await db
      .update(performances)
      .set({ bandName: a.bandName, notes: a.notes })
      .where(eq(performances.id, targetId));

    broadcastInvalidate([
      ["performances", a.stageDayId],
      ["performance", id],
      ["performance", targetId],
    ]);
    req.log.debug({ a: id, b: targetId }, "performances swapped");
    return { ok: true };
  });

  /** Shift all performances from a given one onward by ±N minutes. */
  app.post("/stage-days/:stageDayId/shift", async (req, reply) => {
    const { stageDayId } = stageDayIdParam.parse(req.params);
    const { fromPerformanceId, minutes } = z
      .object({
        fromPerformanceId: z.string().uuid(),
        minutes: z.number().int().min(-720).max(720),
      })
      .parse(req.body);

    const [day] = await db
      .select()
      .from(stageDays)
      .where(eq(stageDays.id, stageDayId));
    if (!day) return reply.code(404).send({ error: "NotFound" });

    const rows = await db
      .select()
      .from(performances)
      .where(eq(performances.stageDayId, stageDayId))
      .orderBy(asc(performances.startTime), asc(performances.id));

    const fromIdx = rows.findIndex((r) => r.id === fromPerformanceId);
    if (fromIdx < 0) return reply.code(404).send({ error: "Performance not found on this day" });

    const toShift = rows.slice(fromIdx);
    const updated: string[] = [];
    for (const p of toShift) {
      const newStart = addMinutes(p.startTime, minutes);
      const newEnd = p.endTime ? addMinutes(p.endTime, minutes) : null;
      await db
        .update(performances)
        .set({ startTime: newStart, endTime: newEnd })
        .where(eq(performances.id, p.id));
      updated.push(p.id);
    }

    broadcastInvalidate([
      ["performances", stageDayId],
      ...updated.map((uid) => ["performance", uid] as (string | null)[]),
    ]);
    req.log.debug(
      { stageDayId, fromPerformanceId, minutes, count: updated.length },
      "performances shifted",
    );
    return { shifted: updated.length };
  });

  app.delete("/performances/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [existing] = await db.select().from(performances).where(eq(performances.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    await db.delete(performances).where(eq(performances.id, id));

    broadcastInvalidate([
      ["performances", existing.stageDayId],
      ["performance", id],
    ]);
    req.log.debug({ performanceId: id }, "performance deleted");
    return reply.code(204).send();
  });
};
