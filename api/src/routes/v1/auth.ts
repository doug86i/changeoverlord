import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../../db/client.js";
import { settings } from "../../db/schema.js";
import {
  createSessionToken,
  sessionCookieName,
  verifySessionToken,
} from "../../lib/session-token.js";

async function hasPassword(): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: settings.passwordHash })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  return Boolean(row?.passwordHash);
}

const loginBody = z.object({
  password: z.string().min(1).max(500),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (req, reply) => {
    const body = loginBody.parse(req.body);
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    if (!row?.passwordHash) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "No password is configured — open LAN mode",
      });
    }
    const ok = await bcrypt.compare(body.password, row.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const token = createSessionToken();
    reply.setCookie(sessionCookieName, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 604800,
    });
    return { ok: true };
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(sessionCookieName, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/session", async (req) => {
    const passwordRequired = await hasPassword();
    if (!passwordRequired) {
      return { authenticated: true, passwordRequired: false };
    }
    const token = req.cookies[sessionCookieName];
    const authenticated = verifySessionToken(token);
    return { authenticated, passwordRequired: true };
  });
};
