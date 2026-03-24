import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { invalidatePasswordSettingsCache } from "../../lib/password-cache.js";
import { normalizePublicBaseUrl } from "../../lib/public-base-url.js";
import { settings } from "../../db/schema.js";

const setInitialBody = z.object({
  password: z.string().min(1).max(500),
});

const changeBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1).max(500),
});

const clearBody = z.object({
  currentPassword: z.string().min(1),
});

const patchSettingsBody = z.object({
  publicBaseUrl: z.union([z.string(), z.null()]),
});

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/settings", async () => {
    const [row] = await db
      .select({
        passwordHash: settings.passwordHash,
        publicBaseUrl: settings.publicBaseUrl,
      })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    return {
      hasPassword: Boolean(row?.passwordHash),
      publicBaseUrl: row?.publicBaseUrl ?? null,
    };
  });

  app.patch("/settings", async (req, reply) => {
    const body = patchSettingsBody.parse(req.body);
    const normalized = normalizePublicBaseUrl(body.publicBaseUrl);
    if (!normalized.ok) {
      return reply.code(400).send({
        error: "ValidationError",
        message: normalized.message,
      });
    }
    await db
      .update(settings)
      .set({ publicBaseUrl: normalized.value, updatedAt: new Date() })
      .where(eq(settings.id, 1));
    broadcastInvalidate([["settings"]]);
    req.log.debug(
      { publicBaseUrl: normalized.value },
      "settings public base url updated",
    );
    return { publicBaseUrl: normalized.value };
  });

  app.post("/settings/password", async (req, reply) => {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    const existing = row?.passwordHash;

    if (!existing) {
      const body = setInitialBody.parse(req.body);
      const hash = await bcrypt.hash(body.password, 10);
      await db
        .update(settings)
        .set({ passwordHash: hash, updatedAt: new Date() })
        .where(eq(settings.id, 1));
      invalidatePasswordSettingsCache();
      broadcastInvalidate([["settings"], ["authSession"]]);
      req.log.info({ settings: "password", action: "initial_set" }, "settings");
      return reply.code(201).send({ ok: true });
    }

    const body = changeBody.parse(req.body);
    const ok = await bcrypt.compare(body.currentPassword, existing);
    if (!ok) {
      req.log.warn({ settings: "password", action: "change", result: "denied" }, "settings");
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const hash = await bcrypt.hash(body.newPassword, 10);
    await db
      .update(settings)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(settings.id, 1));
    invalidatePasswordSettingsCache();
    broadcastInvalidate([["settings"], ["authSession"]]);
    req.log.info({ settings: "password", action: "change", result: "ok" }, "settings");
    return { ok: true };
  });

  app.delete("/settings/password", async (req, reply) => {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    if (!row?.passwordHash) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "No password to remove",
      });
    }
    const body = clearBody.parse(req.body);
    const ok = await bcrypt.compare(body.currentPassword, row.passwordHash);
    if (!ok) {
      req.log.warn({ settings: "password", action: "clear", result: "denied" }, "settings");
      return reply.code(401).send({ error: "Unauthorized" });
    }
    await db
      .update(settings)
      .set({ passwordHash: null, updatedAt: new Date() })
      .where(eq(settings.id, 1));
    invalidatePasswordSettingsCache();
    broadcastInvalidate([["settings"], ["authSession"]]);
    req.log.info({ settings: "password", action: "clear", result: "ok" }, "settings");
    return reply.code(204).send();
  });
};
