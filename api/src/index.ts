import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db/client.js";
import { buildApp } from "./app.js";
import { createLogger, log } from "./lib/log.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const migrationsFolder = path.join(__dirname, "..", "drizzle");
  const boot = createLogger("migrate");
  boot.info({ migrationsFolder }, "running migrations");
  await migrate(db, { migrationsFolder });
  boot.debug("migrations finished");
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

async function main() {
  await runMigrations();
  const app = await buildApp();
  await app.listen({ port, host });
  log.info({ port, host }, "server listening");
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
