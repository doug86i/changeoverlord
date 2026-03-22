import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { drizzleDebugLogger } from "../lib/drizzle-logger.js";
import { createLogger, isDebugLevel } from "../lib/log.js";

const dbLog = createLogger("db-pool");

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://stageops:stageops@127.0.0.1:5432/stageops";

export const pool = new pg.Pool({
  connectionString,
  max: 20,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  dbLog.error({ err }, "Postgres pool idle client error");
});

export const db = drizzle(pool, {
  schema,
  ...(isDebugLevel() ? { logger: drizzleDebugLogger } : {}),
});
