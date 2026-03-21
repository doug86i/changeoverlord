import type { FastifyPluginAsync } from "fastify";

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
};
