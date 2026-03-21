import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { settings } from "../../db/schema.js";

export const metaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    ok: true,
    service: "changeoverlord-api",
  }));

  app.get("/time", async () => {
    const now = new Date();
    return {
      iso: now.toISOString(),
      unixMs: now.getTime(),
    };
  });

  app.get("/settings", async () => {
    const [row] = await db
      .select({ passwordHash: settings.passwordHash })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    return {
      hasPassword: Boolean(row?.passwordHash),
    };
  });
};
