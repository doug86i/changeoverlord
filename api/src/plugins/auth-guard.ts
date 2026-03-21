import cookie from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";
import {
  sessionCookieName,
  verifySessionToken,
} from "../lib/session-token.js";

async function hasPassword(): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: settings.passwordHash })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  return Boolean(row?.passwordHash);
}

function isPublicPath(path: string, method: string): boolean {
  if (path === "/api/v1/health" || path === "/api/v1/time") return true;
  if (path.startsWith("/api/v1/auth")) return true;
  if (path === "/api/v1/settings" && method === "GET") return true;
  return false;
}

/** Accepts the Fastify app instance (logger generic varies with pino). */
export async function registerAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any,
): Promise<void> {
  await app.register(cookie);

  app.addHook(
    "onRequest",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const path = req.url.split("?")[0];

      if (path.startsWith("/api/v1")) {
        if (isPublicPath(path, req.method)) return;

        const passwordOn = await hasPassword();
        if (!passwordOn) return;

        const token = req.cookies[sessionCookieName];
        if (!verifySessionToken(token)) {
          req.log.debug({ path }, "auth: unauthorized api");
          return reply.code(401).send({ error: "Unauthorized" });
        }
        return;
      }

      if (path.startsWith("/ws/")) {
        const passwordOn = await hasPassword();
        if (!passwordOn) return;

        const token = req.cookies[sessionCookieName];
        if (!verifySessionToken(token)) {
          req.log.debug({ path }, "auth: unauthorized ws");
          return reply.code(401).send({ error: "Unauthorized" });
        }
      }
    },
  );
}
