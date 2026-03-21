import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://stageops:stageops@127.0.0.1:5432/stageops";

export const pool = new pg.Pool({
  connectionString,
  max: 20,
});

export const db = drizzle(pool, { schema });
