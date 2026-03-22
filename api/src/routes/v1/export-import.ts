import type { FastifyPluginAsync } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import {
  events,
  stages,
  stageDays,
  performances,
  performanceWorkbooks,
} from "../../db/schema.js";
import { normalizePerformanceBandName } from "../../lib/performance-band-name.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { uuidParam } from "../../schemas/api.js";

const importBodySchema = z.object({
  version: z.literal(2),
  event: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(500),
    startDate: z.string().min(1).max(32),
    endDate: z.string().min(1).max(32),
  }),
  stages: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200),
        sortOrder: z.number().int(),
        eventId: z.string().uuid(),
      }),
    )
    .max(500),
  stageDays: z
    .array(
      z.object({
        id: z.string().uuid(),
        stageId: z.string().uuid(),
        dayDate: z.string().min(1).max(32),
        sortOrder: z.number().int(),
      }),
    )
    .max(5000),
  performances: z
    .array(
      z.object({
        id: z.string().uuid(),
        stageDayId: z.string().uuid(),
        sortOrder: z.number().int(),
        bandName: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        startTime: z.string().min(1).max(16),
        endTime: z.string().nullable().optional(),
      }),
    )
    .max(50_000),
  workbooks: z
    .array(
      z.object({
        performanceId: z.string().uuid(),
        /** FortuneSheet `Sheet[]` as JSON */
        sheets: z.array(z.unknown()),
      }),
    )
    .max(5000)
    .optional(),
});

export const exportImportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events/:id/export", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [ev] = await db.select().from(events).where(eq(events.id, id));
    if (!ev) return reply.code(404).send({ error: "NotFound" });

    const stageRows = await db.select().from(stages).where(eq(stages.eventId, id));
    const stageIds = stageRows.map((s) => s.id);
    const dayRows =
      stageIds.length > 0
        ? await db.select().from(stageDays).where(inArray(stageDays.stageId, stageIds))
        : [];
    const dayIds = dayRows.map((d) => d.id);
    const perfRows =
      dayIds.length > 0
        ? await db.select().from(performances).where(inArray(performances.stageDayId, dayIds))
        : [];
    const perfIds = perfRows.map((p) => p.id);
    const workbookRows =
      perfIds.length > 0
        ? await db
            .select()
            .from(performanceWorkbooks)
            .where(inArray(performanceWorkbooks.performanceId, perfIds))
        : [];

    const payload = {
      version: 2 as const,
      exportedAt: new Date().toISOString(),
      event: ev,
      stages: stageRows,
      stageDays: dayRows,
      performances: perfRows,
      workbooks: workbookRows.map((w) => ({
        performanceId: w.performanceId,
        sheets: w.sheetsJson,
        updatedAt: w.updatedAt,
      })),
    };

    req.log.debug({ eventId: id }, "event exported");

    reply.header("Content-Type", "application/json");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${ev.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_export.json"`,
    );
    return reply.send(JSON.stringify(payload, null, 2));
  });

  app.post(
    "/import",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
    const parsed = importBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "Invalid export package (expected version 2 with workbooks)",
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    try {
      const ev = await db.transaction(async (tx) => {
        const [newEv] = await tx
          .insert(events)
          .values({
            name: `${body.event.name} (imported)`,
            startDate: body.event.startDate,
            endDate: body.event.endDate,
          })
          .returning();

        const idMap = new Map<string, string>();
        idMap.set(body.event.id, newEv!.id);

        for (const st of body.stages) {
          const [row] = await tx
            .insert(stages)
            .values({
              eventId: newEv!.id,
              name: st.name,
              sortOrder: st.sortOrder,
            })
            .returning();
          idMap.set(st.id, row!.id);
        }

        for (const d of body.stageDays) {
          const newStageId = idMap.get(d.stageId);
          if (!newStageId) continue;
          const [row] = await tx
            .insert(stageDays)
            .values({
              stageId: newStageId,
              dayDate: d.dayDate,
              sortOrder: d.sortOrder,
            })
            .returning();
          idMap.set(d.id, row!.id);
        }

        for (const p of body.performances) {
          const newStageDayId = idMap.get(p.stageDayId);
          if (!newStageDayId) continue;
          const [row] = await tx
            .insert(performances)
            .values({
              stageDayId: newStageDayId,
              sortOrder: p.sortOrder,
              bandName: normalizePerformanceBandName(p.bandName ?? ""),
              notes: p.notes ?? "",
              startTime: p.startTime,
              endTime: p.endTime ?? null,
            })
            .returning();
          idMap.set(p.id, row!.id);
        }

        if (body.workbooks) {
          for (const w of body.workbooks) {
            const newPerfId = idMap.get(w.performanceId);
            if (!newPerfId) continue;
            if (!Array.isArray(w.sheets)) continue;
            await tx
              .insert(performanceWorkbooks)
              .values({
                performanceId: newPerfId,
                sheetsJson: structuredClone(w.sheets) as unknown[],
              })
              .onConflictDoNothing();
          }
        }

        return newEv!;
      });

      broadcastInvalidate([["events"], ["allStagesForClock"]]);
      req.log.debug(
        { importedEventId: ev.id, originalName: body.event.name },
        "event imported",
      );
      return reply.code(201).send({ event: ev });
    } catch (e) {
      req.log.error({ err: e }, "import transaction failed");
      return reply.code(500).send({ error: "InternalError", message: "Import failed" });
    }
    },
  );
};
