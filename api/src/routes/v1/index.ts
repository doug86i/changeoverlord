import type { FastifyPluginAsync } from "fastify";
import { eventsRoutes } from "./events.js";
import { stagesRoutes } from "./stages.js";
import { stageDaysRoutes } from "./stage-days.js";
import { performancesRoutes } from "./performances.js";
import { metaRoutes } from "./meta.js";

export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(metaRoutes);
  await app.register(eventsRoutes);
  await app.register(stagesRoutes);
  await app.register(stageDaysRoutes);
  await app.register(performancesRoutes);
};
