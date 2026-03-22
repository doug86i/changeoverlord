import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { events, stages, performances } from "../../db/schema.js";
import { z } from "zod";
import { escapeIlikePattern } from "../../lib/escape-ilike.js";

const searchQuery = z.object({ q: z.string().min(1).max(200) });

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get("/search", async (req) => {
    const { q } = searchQuery.parse(req.query);
    const pattern = `%${escapeIlikePattern(q)}%`;

    const [perfRows, eventRows, stageRows] = await Promise.all([
      db
        .select({
          id: performances.id,
          bandName: performances.bandName,
          startTime: performances.startTime,
          stageDayId: performances.stageDayId,
        })
        .from(performances)
        .where(sql`${performances.bandName} ILIKE ${pattern} ESCAPE '\\'`)
        .limit(30),
      db
        .select({ id: events.id, name: events.name, startDate: events.startDate })
        .from(events)
        .where(sql`${events.name} ILIKE ${pattern} ESCAPE '\\'`)
        .limit(20),
      db
        .select({ id: stages.id, name: stages.name, eventId: stages.eventId })
        .from(stages)
        .where(sql`${stages.name} ILIKE ${pattern} ESCAPE '\\'`)
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
