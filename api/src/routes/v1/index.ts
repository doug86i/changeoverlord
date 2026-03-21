import type { FastifyPluginAsync } from "fastify";
import { eventsRoutes } from "./events.js";
import { stagesRoutes } from "./stages.js";
import { stageDaysRoutes } from "./stage-days.js";
import { performancesRoutes } from "./performances.js";
import { metaRoutes } from "./meta.js";
import { authRoutes } from "./auth.js";
import { settingsRoutes } from "./settings-routes.js";
import { realtimeSseRoutes } from "./realtime-sse.js";
import { patchTemplatesRoutes } from "./patch-templates.js";
import { filesRoutes } from "./files.js";
import { searchRoutes } from "./search.js";
import { exportImportRoutes } from "./export-import.js";

export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(metaRoutes);
  await app.register(realtimeSseRoutes);
  await app.register(authRoutes);
  await app.register(settingsRoutes);
  await app.register(eventsRoutes);
  await app.register(patchTemplatesRoutes);
  await app.register(filesRoutes);
  await app.register(stagesRoutes);
  await app.register(stageDaysRoutes);
  await app.register(performancesRoutes);
  await app.register(searchRoutes);
  await app.register(exportImportRoutes);
};
