import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../../db/client.js";
import { settings } from "../../db/schema.js";
import { sessionCookieOptions } from "../../lib/cookie-flags.js";
import { getCachedHasPassword } from "../../lib/password-cache.js";
import {
  createSessionToken,
  sessionCookieName,
  verifySessionToken,
} from "../../lib/session-token.js";

const loginBody = z.object({
  password: z.string().min(1).max(500),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 15,
          timeWindow: "5 minutes",
          errorResponseBuilder: () => ({
            error: "TooManyRequests",
            message: "Too many attempts, try again in 5 minutes.",
          }),
        },
      },
    },
    async (req, reply) => {
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
      req.log.warn({ auth: "login", result: "failure" }, "auth");
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const token = createSessionToken();
    const cookieOpts = sessionCookieOptions(req);
    reply.setCookie(sessionCookieName, token, {
      httpOnly: true,
      path: "/",
      maxAge: 604800,
      ...cookieOpts,
    });
    req.log.info({ auth: "login", result: "success" }, "auth");
    return { ok: true };
  },
  );

  app.post("/auth/logout", async (req, reply) => {
    reply.clearCookie(sessionCookieName, {
      path: "/",
      ...sessionCookieOptions(req),
    });
    req.log.info({ auth: "logout" }, "auth");
    return { ok: true };
  });

  app.get("/auth/session", async (req) => {
    const passwordRequired = await getCachedHasPassword();
    if (!passwordRequired) {
      return { authenticated: true, passwordRequired: false };
    }
    const token = req.cookies[sessionCookieName];
    const authenticated = verifySessionToken(token);
    return { authenticated, passwordRequired: true };
  });
};
