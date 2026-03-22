import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { Sheet } from "@fortune-sheet/core";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { validatePerformanceSchedule, hhmmToMinutes } from "../../lib/performance-overlap.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { broadcastFullStateToPerformanceRoom } from "../../plugins/collab-ws-relay.js";
import {
  performanceWorkbooks,
  patchTemplates,
  stageDays,
  performances,
  stages,
} from "../../db/schema.js";
import { parseWorkbookJsonRoot } from "../../lib/json-patch-template.js";
import {
  buildWorkbookJsonExportV1,
  safeDownloadBasename,
} from "../../lib/workbook-json-envelope.js";
import {
  sheetsFromJsonb,
  sheetsLookUsableAfterOpLogReplay,
} from "../../lib/workbook-ops.js";
import {
  createPerformanceBody,
  patchPerformanceBody,
  stageDayIdParam,
  uuidParam,
} from "../../schemas/api.js";
import { z } from "zod";

const JSON_SHEETS_BODY_LIMIT = 12 * 1024 * 1024;

function addMinutes(hhmm: string, delta: number): string {
  const base = hhmmToMinutes(hhmm);
  if (Number.isNaN(base)) return hhmm;
  let total = base + delta;
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

    const [seed] = await db
      .select({ sheetsJson: patchTemplates.sheetsJson })
      .from(stages)
      .leftJoin(
        patchTemplates,
        eq(stages.defaultPatchTemplateId, patchTemplates.id),
      )
      .where(eq(stages.id, day.stageId))
      .limit(1);

    const row = await db.transaction(async (tx) => {
      const [inserted] = await tx
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

      const templateSheets = seed?.sheetsJson;
      if (
        templateSheets != null &&
        Array.isArray(templateSheets) &&
        sheetsLookUsableAfterOpLogReplay(templateSheets as Sheet[])
      ) {
        const copy = structuredClone(templateSheets) as unknown[];
        await tx
          .insert(performanceWorkbooks)
          .values({
            performanceId: inserted!.id,
            sheetsJson: copy,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: performanceWorkbooks.performanceId,
            set: {
              sheetsJson: copy,
              updatedAt: new Date(),
            },
          });
      }
      return inserted!;
    });

    broadcastInvalidate([
      ["performances", stageDayId],
      ["performance", row.id],
    ]);
    req.log.debug(
      {
        performanceId: row.id,
        stageDayId,
        seededWorkbook: Boolean(
          seed?.sheetsJson != null &&
            Array.isArray(seed.sheetsJson) &&
            sheetsLookUsableAfterOpLogReplay(seed.sheetsJson as Sheet[]),
        ),
      },
      "performance created",
    );
    return reply.code(201).send({ performance: row });
  });

  app.get("/performances/:id/sheets-export", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [perf] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, id));
    if (!perf) return reply.code(404).send({ error: "NotFound" });
    const [wb] = await db
      .select({ sheetsJson: performanceWorkbooks.sheetsJson })
      .from(performanceWorkbooks)
      .where(eq(performanceWorkbooks.performanceId, id))
      .limit(1);
    const sheets = sheetsFromJsonb(wb?.sheetsJson);
    if (!sheetsLookUsableAfterOpLogReplay(sheets)) {
      return reply.code(404).send({
        error: "NotFound",
        message: "No patch workbook for this performance",
      });
    }
    const label = perf.bandName || "performance";
    const payload = buildWorkbookJsonExportV1(
      "performance",
      label,
      sheets,
      { performanceId: id },
    );
    const fname = safeDownloadBasename(label, "patch");
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${fname}_workbook.json"`,
    );
    req.log.debug({ performanceId: id }, "performance workbook exported");
    return reply.send(JSON.stringify(payload, null, 2));
  });

  app.put(
    "/performances/:id/sheets-import",
    { bodyLimit: JSON_SHEETS_BODY_LIMIT },
    async (req, reply) => {
      const { id } = uuidParam.parse(req.params);
      const [perf] = await db
        .select()
        .from(performances)
        .where(eq(performances.id, id));
      if (!perf) return reply.code(404).send({ error: "NotFound" });

      let sheets;
      try {
        sheets = parseWorkbookJsonRoot(req.body);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Invalid workbook JSON";
        return reply.code(400).send({ error: "ValidationError", message: msg });
      }

      const sheetsJson = structuredClone(sheets) as unknown[];

      const [existing] = await db
        .select()
        .from(performanceWorkbooks)
        .where(eq(performanceWorkbooks.performanceId, id));
      if (existing) {
        await db
          .update(performanceWorkbooks)
          .set({ sheetsJson, updatedAt: new Date() })
          .where(eq(performanceWorkbooks.performanceId, id));
      } else {
        await db.insert(performanceWorkbooks).values({
          performanceId: id,
          sheetsJson,
          updatedAt: new Date(),
        });
      }

      broadcastFullStateToPerformanceRoom(id, sheets);

      broadcastInvalidate([
        ["performances", perf.stageDayId],
        ["performance", id],
      ]);
      req.log.debug({ performanceId: id }, "performance workbook imported from JSON");
      return { ok: true };
    },
  );

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
    const [before] = await db.select().from(performances).where(eq(performances.id, id));
    if (!before) return reply.code(404).send({ error: "NotFound" });

    if (body.startTime || body.endTime !== undefined) {
      const mergedStart = body.startTime ?? before.startTime;
      const mergedEnd =
        body.endTime !== undefined ? body.endTime : before.endTime;
      const startM = hhmmToMinutes(mergedStart);
      const endM = mergedEnd !== null ? hhmmToMinutes(mergedEnd) : null;
      if (Number.isNaN(startM) || (endM !== null && Number.isNaN(endM))) {
        return reply.code(400).send({
          error: "ValidationError",
          message: "Invalid time (use HH:mm)",
        });
      }
      if (mergedEnd !== null && endM! <= startM) {
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

    await db.transaction(async (tx) => {
      await tx
        .update(performances)
        .set({ bandName: b.bandName, notes: b.notes })
        .where(eq(performances.id, id));
      await tx
        .update(performances)
        .set({ bandName: a.bandName, notes: a.notes })
        .where(eq(performances.id, targetId));
    });

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
    await db.transaction(async (tx) => {
      for (const p of toShift) {
        const newStart = addMinutes(p.startTime, minutes);
        const newEnd = p.endTime ? addMinutes(p.endTime, minutes) : null;
        await tx
          .update(performances)
          .set({ startTime: newStart, endTime: newEnd })
          .where(eq(performances.id, p.id));
        updated.push(p.id);
      }
    });

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
