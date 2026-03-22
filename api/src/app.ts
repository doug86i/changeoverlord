import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { v1Routes } from "./routes/v1/index.js";
import { registerAuth } from "./plugins/auth-guard.js";
import { collabWsPlugin } from "./plugins/collab-ws.js";
import { log } from "./lib/log.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePublicDir(): string {
  const env = process.env.WEB_PUBLIC_DIR;
  if (env) return path.resolve(env);
  return path.join(__dirname, "..", "public");
}

export async function buildApp() {
  const debug = process.env.LOG_LEVEL === "debug" || process.env.LOG_LEVEL === "trace";
  const app = Fastify({
    loggerInstance: log,
    requestIdHeader: "x-request-id",
    trustProxy: true,
    // Per-request timing + method/url when troubleshooting; enable with LOG_LEVEL=debug even in production NODE_ENV.
    disableRequestLogging: process.env.NODE_ENV === "production" && !debug,
  });

  const corsAllowlist =
    process.env.CORS_ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  await app.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (corsAllowlist.length > 0) {
        cb(null, corsAllowlist.includes(origin));
        return;
      }
      if (process.env.NODE_ENV !== "production") {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
  });

  // No CSP for now (LAN SPA); other Helmet defaults still apply. Enable CSP later with nonces/hashes if needed.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(rateLimit, { global: false });

  await registerAuth(app);

  await app.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  await app.register(collabWsPlugin);

  await app.register(v1Routes, { prefix: "/api/v1" });

  const publicDir = resolvePublicDir();
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
  });

  app.setNotFoundHandler(async (req, reply) => {
    const url = req.raw.url ?? "";
    if (url.startsWith("/api")) {
      return reply.code(404).send({ error: "NotFound" });
    }
    const html = await readFile(path.join(publicDir, "index.html"), "utf8");
    return reply.type("text/html").send(html);
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "ValidationError",
        details: err.flatten(),
      });
    }
    req.log.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    return reply.code(500).send({
      error: "InternalError",
      message:
        process.env.NODE_ENV === "production" ? "Something went wrong" : msg,
    });
  });

  return app;
}
