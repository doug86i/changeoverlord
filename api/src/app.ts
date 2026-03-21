import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { v1Routes } from "./routes/v1/index.js";
import { log } from "./lib/log.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePublicDir(): string {
  const env = process.env.WEB_PUBLIC_DIR;
  if (env) return path.resolve(env);
  return path.join(__dirname, "..", "public");
}

export async function buildApp() {
  const app = Fastify({
    loggerInstance: log,
    requestIdHeader: "x-request-id",
    disableRequestLogging: process.env.NODE_ENV === "production",
  });

  await app.register(cors, { origin: true });

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
