import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { db, pool } from "./db/client.js";
import { buildApp } from "./app.js";
import { createLogger, log } from "./lib/log.js";
import { flushCollabRelayRooms } from "./plugins/collab-ws-relay.js";
import { settings } from "./db/schema.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEV_SESSION_FALLBACK = "dev-only-change-in-production";

function assertProductionSessionSecret() {
  if (process.env.NODE_ENV !== "production") return;
  const s = process.env.SESSION_SECRET;
  if (!s || s === DEV_SESSION_FALLBACK) {
    log.error(
      "SESSION_SECRET must be set to a strong random value in production (NODE_ENV=production)",
    );
    process.exit(1);
  }
}

async function assertPasswordRequiredIfConfigured() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.REQUIRE_PASSWORD !== "1") return;
  const [row] = await db
    .select({ passwordHash: settings.passwordHash })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  if (!row?.passwordHash) {
    log.error(
      "REQUIRE_PASSWORD=1 is set, but no shared password is configured. Set one in Settings before internet exposure.",
    );
    process.exit(1);
  }
}

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
  assertProductionSessionSecret();
  await runMigrations();
  await assertPasswordRequiredIfConfigured();
  const app = await buildApp();
  await app.listen({ port, host });
  log.info({ port, host }, "server listening");

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, "graceful shutdown started");
    try {
      await flushCollabRelayRooms();
    } catch (err) {
      log.error({ err }, "error flushing collab relay during shutdown");
    }
    try {
      await app.close();
    } catch (err) {
      log.error({ err }, "error closing Fastify during shutdown");
    }
    try {
      await pool.end();
    } catch (err) {
      log.error({ err }, "error closing Postgres pool during shutdown");
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
