import type { FastifyPluginAsync } from "fastify";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../../lib/log.js";
import { clientDebugLogBody } from "../../schemas/api.js";

const bootLog = createLogger("client-debug-log");

/**
 * Allow log paths under the API cwd, or under the monorepo root when the process cwd is the
 * **`api/`** workspace (`npm run dev -w @changeoverlord/api` → **`/app/api`** in Docker). Compose
 * sets **`CLIENT_LOG_FILE=/app/logs/...`** which is sibling to **`api/`**, not a child of it.
 */
function resolveSafeLogFile(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const resolved = path.isAbsolute(trimmed)
    ? path.normalize(trimmed)
    : path.resolve(process.cwd(), trimmed);
  const cwd = path.resolve(process.cwd());
  const roots = [cwd];
  if (path.basename(cwd) === "api") {
    roots.push(path.resolve(cwd, ".."));
  }
  for (const root of roots) {
    const norm = path.normalize(root);
    const prefix = norm.endsWith(path.sep) ? norm : `${norm}${path.sep}`;
    if (resolved === norm || resolved.startsWith(prefix)) {
      return resolved;
    }
  }
  return null;
}

/**
 * Append browser debug lines to an NDJSON file when `CLIENT_LOG_FILE` is set.
 * Disabled entirely when unset — no route registered (avoids 404 spam from the SPA).
 */
export const clientDebugLogRoutes: FastifyPluginAsync = async (app) => {
  const fileEnv = process.env.CLIENT_LOG_FILE?.trim();
  if (!fileEnv) return;
  const logFile = resolveSafeLogFile(fileEnv);
  if (!logFile) {
    bootLog.warn({ CLIENT_LOG_FILE: fileEnv }, "CLIENT_LOG_FILE outside cwd — route disabled");
    return;
  }
  bootLog.info({ path: logFile }, "client debug log ingest enabled");

  app.post("/debug/client-log", async (req, reply) => {
    const body = clientDebugLogBody.parse(req.body);
    const dir = path.dirname(logFile);
    await mkdir(dir, { recursive: true });
    const chunk = body.lines.map((l) => `${JSON.stringify(l)}\n`).join("");
    await appendFile(logFile, chunk, "utf8");
    req.log.debug(
      { count: body.lines.length, path: logFile },
      "client debug log batch appended",
    );
    return reply.code(204).send();
  });
};
