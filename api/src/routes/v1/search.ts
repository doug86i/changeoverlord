import type { FastifyPluginAsync } from "fastify";
import { ilike } from "drizzle-orm";
import { db } from "../../db/client.js";
import { events, stages, performances } from "../../db/schema.js";
import { z } from "zod";

const searchQuery = z.object({ q: z.string().min(1).max(200) });

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get("/search", async (req) => {
    const { q } = searchQuery.parse(req.query);
    const pattern = `%${q}%`;

    const [perfRows, eventRows, stageRows] = await Promise.all([
      db
        .select({
          id: performances.id,
          bandName: performances.bandName,
          startTime: performances.startTime,
          stageDayId: performances.stageDayId,
        })
        .from(performances)
        .where(ilike(performances.bandName, pattern))
        .limit(30),
      db
        .select({ id: events.id, name: events.name, startDate: events.startDate })
        .from(events)
        .where(ilike(events.name, pattern))
        .limit(20),
      db
        .select({ id: stages.id, name: stages.name, eventId: stages.eventId })
        .from(stages)
        .where(ilike(stages.name, pattern))
        .limit(20),
    ]);

    req.log.debug({ q, results: perfRows.length + eventRows.length + stageRows.length }, "search");

    return {
      performances: perfRows,
      events: eventRows,
      stages: stageRows,
    };
  });
};
