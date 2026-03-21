import type { FastifyPluginAsync } from "fastify";
import type { Sheet } from "@fortune-sheet/core";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { excelBufferToSheets } from "../../lib/excel-to-sheets.js";
import { getUploadsDir } from "../../lib/uploads-dir.js";
import { sheetsToPreviewPayload } from "../../lib/sheet-preview.js";
import {
  decodeTemplateSnapshotToSheets,
  encodeTemplateSnapshotFromSheets,
} from "../../lib/yjs-template-snapshot.js";
import { patchTemplates, stages } from "../../db/schema.js";
import { uuidParam } from "../../schemas/api.js";
import {
  excelTemplateStorageExtension,
  isExcelOoxmlTemplate,
  stripExcelTemplateBasename,
} from "../../lib/upload-allowlists.js";

const MAX_BYTES = 10 * 1024 * 1024;

const patchNameBody = z.object({
  name: z.string().min(1).max(200),
});

const duplicateBody = z.object({
  name: z.string().min(1).max(200).optional(),
});

function invalidateAll() {
  broadcastInvalidate([["patchTemplates"], ["patchTemplate"], ["events"]]);
}

export const patchTemplatesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/patch-templates", async () => {
    const rows = await db
      .select({
        id: patchTemplates.id,
        name: patchTemplates.name,
        originalName: patchTemplates.originalName,
        byteSize: patchTemplates.byteSize,
        createdAt: patchTemplates.createdAt,
        updatedAt: patchTemplates.updatedAt,
      })
      .from(patchTemplates)
      .orderBy(desc(patchTemplates.createdAt));
    return { patchTemplates: rows };
  });

  app.get("/patch-templates/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    const [usage] = await db
      .select({ c: count() })
      .from(stages)
      .where(eq(stages.defaultPatchTemplateId, id));

    const uploadsRoot = getUploadsDir();
    const abs = path.join(uploadsRoot, row.storageKey);
    const fromYjs = decodeTemplateSnapshotToSheets(Buffer.from(row.snapshot));
    let initialSheets: Sheet[];
    if (fromYjs.length > 0) {
      initialSheets = fromYjs;
    } else {
      try {
        const buf = await fs.readFile(abs);
        initialSheets = await excelBufferToSheets(buf);
      } catch {
        initialSheets = [];
      }
    }

    return {
      patchTemplate: {
        id: row.id,
        name: row.name,
        originalName: row.originalName,
        byteSize: row.byteSize,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        usedByStageCount: Number(usage?.c ?? 0),
        /** FortuneSheet `data` seed so remount + Yjs opLog replay match stored structure (avoids Immer path errors). */
        initialSheets,
      },
    };
  });

  app.get("/patch-templates/:id/preview", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    const uploadsRoot = getUploadsDir();
    const abs = path.join(uploadsRoot, row.storageKey);
    const fromYjs = decodeTemplateSnapshotToSheets(Buffer.from(row.snapshot));
    let sheets: Sheet[];
    if (fromYjs.length > 0) {
      sheets = fromYjs;
    } else {
      try {
        const buf = await fs.readFile(abs);
        sheets = await excelBufferToSheets(buf);
      } catch {
        sheets = [];
      }
    }
    return sheetsToPreviewPayload(sheets);
  });

  app.post("/patch-templates", async (req, reply) => {
    const q = z
      .object({ name: z.string().min(1).max(200).optional() })
      .parse(req.query);
    const data = await req.file();
    if (!data) {
      return reply
        .code(400)
        .send({ error: "ValidationError", message: "Missing file field" });
    }
    const buf = await data.toBuffer();
    const filename = data.filename;
    const mime = data.mimetype || "application/octet-stream";
    const displayName =
      q.name?.trim() ||
      (filename ? stripExcelTemplateBasename(filename).trim() : "") ||
      "Template";
    if (buf.length === 0) {
      return reply.code(400).send({ error: "ValidationError", message: "Empty file" });
    }
    if (buf.length > MAX_BYTES) {
      return reply.code(413).send({ error: "PayloadTooLarge" });
    }
    if (!isExcelOoxmlTemplate(filename, mime)) {
      return reply.code(400).send({
        error: "ValidationError",
        message:
          "Upload an Excel workbook (.xlsx, .xlsm, .xltx, .xltm, or matching MIME type)",
      });
    }
    let sheets;
    try {
      sheets = await excelBufferToSheets(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid Excel file";
      return reply.code(400).send({ error: "ValidationError", message: msg });
    }
    const snapshot = encodeTemplateSnapshotFromSheets(sheets);
    const uploadsRoot = getUploadsDir();
    const tmplExt = excelTemplateStorageExtension(filename);
    const storageKey = `patch-templates/${randomUUID()}${tmplExt}`;
    const abs = path.join(uploadsRoot, storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);

    const [inserted] = await db
      .insert(patchTemplates)
      .values({
        name: displayName,
        originalName: filename || `template${tmplExt}`,
        storageKey,
        mimeType: mime,
        byteSize: buf.length,
        snapshot,
      })
      .returning({ id: patchTemplates.id });

    invalidateAll();
    req.log.info({ templateId: inserted?.id }, "patch template created");
    return reply.code(201).send({ patchTemplate: { id: inserted?.id } });
  });

  app.post("/patch-templates/:id/duplicate", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = duplicateBody.parse(req.body ?? {});
    const [existing] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    const uploadsRoot = getUploadsDir();
    const srcAbs = path.join(uploadsRoot, existing.storageKey);
    let fileBuf: Buffer;
    try {
      fileBuf = await fs.readFile(srcAbs);
    } catch {
      return reply.code(500).send({
        error: "ServerError",
        message: "Template file missing on disk",
      });
    }

    const ext = path.extname(existing.storageKey) || ".xlsx";
    const newStorageKey = `patch-templates/${randomUUID()}${ext}`;
    const dstAbs = path.join(uploadsRoot, newStorageKey);
    await fs.mkdir(path.dirname(dstAbs), { recursive: true });
    await fs.writeFile(dstAbs, fileBuf);

    const base =
      body.name?.trim() ||
      `${existing.name} (copy)`.trim().slice(0, 200) ||
      "Copy";
    const displayName = base.slice(0, 200);

    const [inserted] = await db
      .insert(patchTemplates)
      .values({
        name: displayName,
        originalName: existing.originalName,
        storageKey: newStorageKey,
        mimeType: existing.mimeType,
        byteSize: existing.byteSize,
        snapshot: existing.snapshot,
      })
      .returning({ id: patchTemplates.id });

    invalidateAll();
    req.log.info(
      { templateId: inserted?.id, sourceTemplateId: id },
      "patch template duplicated",
    );
    return reply.code(201).send({ patchTemplate: { id: inserted?.id } });
  });

  app.patch("/patch-templates/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = patchNameBody.parse(req.body);
    const [row] = await db
      .update(patchTemplates)
      .set({ name: body.name, updatedAt: new Date() })
      .where(eq(patchTemplates.id, id))
      .returning({ id: patchTemplates.id });
    if (!row) return reply.code(404).send({ error: "NotFound" });
    invalidateAll();
    req.log.debug({ templateId: id }, "patch template renamed");
    return { ok: true };
  });

  app.post("/patch-templates/:id/replace", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [existing] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    let buf: Buffer;
    let filename: string | undefined;
    let mime: string;
    try {
      const data = await req.file();
      if (!data) throw new Error("no file");
      buf = await data.toBuffer();
      filename = data.filename;
      mime = data.mimetype || "application/octet-stream";
    } catch {
      return reply
        .code(400)
        .send({ error: "ValidationError", message: "Missing file field" });
    }
    if (buf.length === 0) {
      return reply.code(400).send({ error: "ValidationError", message: "Empty file" });
    }
    if (buf.length > MAX_BYTES) {
      return reply.code(413).send({ error: "PayloadTooLarge" });
    }
    if (!isExcelOoxmlTemplate(filename, mime)) {
      return reply.code(400).send({
        error: "ValidationError",
        message:
          "Upload an Excel workbook (.xlsx, .xlsm, .xltx, .xltm, or matching MIME type)",
      });
    }
    let sheets;
    try {
      sheets = await excelBufferToSheets(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid Excel file";
      return reply.code(400).send({ error: "ValidationError", message: msg });
    }
    const snapshot = encodeTemplateSnapshotFromSheets(sheets);
    const uploadsRoot = getUploadsDir();
    const oldAbs = path.join(uploadsRoot, existing.storageKey);
    try {
      await fs.unlink(oldAbs);
    } catch {
      /* ignore */
    }
    const tmplExt = excelTemplateStorageExtension(filename);
    const storageKey = `patch-templates/${randomUUID()}${tmplExt}`;
    const abs = path.join(uploadsRoot, storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);

    await db
      .update(patchTemplates)
      .set({
        originalName: filename || existing.originalName,
        storageKey,
        mimeType: mime,
        byteSize: buf.length,
        snapshot,
        updatedAt: new Date(),
      })
      .where(eq(patchTemplates.id, id));

    invalidateAll();
    req.log.info({ templateId: id }, "patch template file replaced");
    return { ok: true };
  });

  app.delete("/patch-templates/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [existing] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    const uploadsRoot = getUploadsDir();
    try {
      await fs.unlink(path.join(uploadsRoot, existing.storageKey));
    } catch {
      /* ignore */
    }

    await db
      .update(stages)
      .set({ defaultPatchTemplateId: null })
      .where(eq(stages.defaultPatchTemplateId, id));

    await db.delete(patchTemplates).where(eq(patchTemplates.id, id));

    invalidateAll();
    req.log.info({ templateId: id }, "patch template deleted");
    return reply.code(204).send();
  });
};
