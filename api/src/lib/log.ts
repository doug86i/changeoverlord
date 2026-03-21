import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

/**
 * Root logger. Prefer **`req.log`** in HTTP handlers (request id + route context).
 * Use **`createLogger(component)`** for WebSockets, Yjs, bus, migrations — never log secrets.
 */
export const log = pino({
  level,
  redact: {
    paths: [
      "password",
      "*.password",
      "body.password",
      "currentPassword",
      "newPassword",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    remove: true,
  },
  base: { service: "changeoverlord-api" },
});

/** Logger for code paths without a Fastify request (collab WS, Yjs, SSE bus, migrations). */
export function createLogger(component: string) {
  return log.child({ component });
}

export function isDebugLevel(): boolean {
  return level === "debug" || level === "trace";
}
