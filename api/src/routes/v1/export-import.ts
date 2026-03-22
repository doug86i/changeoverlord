import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { events, stages, stageDays, performances, fileAssets, performanceYjsSnapshots } from "../../db/schema.js";
import { normalizePerformanceBandName } from "../../lib/performance-band-name.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { uuidParam } from "../../schemas/api.js";

export const exportImportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events/:id/export", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [ev] = await db.select().from(events).where(eq(events.id, id));
    if (!ev) return reply.code(404).send({ error: "NotFound" });

    const stageRows = await db.select().from(stages).where(eq(stages.eventId, id));
    const dayRows: (typeof stageDays.$inferSelect)[] = [];
    const perfRows: (typeof performances.$inferSelect)[] = [];
    const snapshotRows: (typeof performanceYjsSnapshots.$inferSelect)[] = [];

    for (const st of stageRows) {
      const days = await db.select().from(stageDays).where(eq(stageDays.stageId, st.id));
      dayRows.push(...days);
      for (const d of days) {
        const perfs = await db.select().from(performances).where(eq(performances.stageDayId, d.id));
        perfRows.push(...perfs);
        for (const p of perfs) {
          const [snap] = await db.select().from(performanceYjsSnapshots).where(eq(performanceYjsSnapshots.performanceId, p.id));
          if (snap) snapshotRows.push(snap);
        }
      }
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      event: ev,
      stages: stageRows,
      stageDays: dayRows,
      performances: perfRows,
      snapshots: snapshotRows.map((s) => ({
        performanceId: s.performanceId,
        snapshot: s.snapshot.toString("base64"),
        updatedAt: s.updatedAt,
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

  app.post("/import", async (req, reply) => {
    const body = req.body as {
      version: number;
      event: typeof events.$inferSelect;
      stages: (typeof stages.$inferSelect)[];
      stageDays: (typeof stageDays.$inferSelect)[];
      performances: (typeof performances.$inferSelect)[];
      snapshots?: { performanceId: string; snapshot: string; updatedAt: Date }[];
    };

    if (!body?.version || !body?.event) {
      return reply.code(400).send({ error: "Invalid export format" });
    }

    const [ev] = await db
      .insert(events)
      .values({
        name: body.event.name + " (imported)",
        startDate: body.event.startDate,
        endDate: body.event.endDate,
      })
      .returning();

    const idMap = new Map<string, string>();
    idMap.set(body.event.id, ev.id);

    for (const st of body.stages) {
      const [row] = await db
        .insert(stages)
        .values({ eventId: ev.id, name: st.name, sortOrder: st.sortOrder })
        .returning();
      idMap.set(st.id, row.id);
    }

    for (const d of body.stageDays) {
      const newStageId = idMap.get(d.stageId);
      if (!newStageId) continue;
      const [row] = await db
        .insert(stageDays)
        .values({ stageId: newStageId, dayDate: d.dayDate, sortOrder: d.sortOrder })
        .returning();
      idMap.set(d.id, row.id);
    }

    for (const p of body.performances) {
      const newStageDayId = idMap.get(p.stageDayId);
      if (!newStageDayId) continue;
      const [row] = await db
        .insert(performances)
        .values({
          stageDayId: newStageDayId,
          sortOrder: p.sortOrder,
          bandName: normalizePerformanceBandName(p.bandName ?? ""),
          notes: p.notes,
          startTime: p.startTime,
          endTime: p.endTime,
        })
        .returning();
      idMap.set(p.id, row.id);
    }

    if (body.snapshots) {
      for (const s of body.snapshots) {
        const newPerfId = idMap.get(s.performanceId);
        if (!newPerfId) continue;
        await db
          .insert(performanceYjsSnapshots)
          .values({
            performanceId: newPerfId,
            snapshot: Buffer.from(s.snapshot, "base64"),
          })
          .onConflictDoNothing();
      }
    }

    broadcastInvalidate([["events"]]);
    req.log.debug({ importedEventId: ev.id, originalName: body.event.name }, "event imported");
    return reply.code(201).send({ event: ev });
  });
};
