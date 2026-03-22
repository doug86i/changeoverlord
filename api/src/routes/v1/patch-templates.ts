import type { FastifyPluginAsync } from "fastify";
import type { Sheet } from "@fortune-sheet/core";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { count, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { createLogger } from "../../lib/log.js";
import { createDefaultPatchWorkbookSheets } from "../../lib/default-patch-sheets.js";
import { excelBufferToSheets } from "../../lib/excel-to-sheets.js";
import {
  bufferLooksLikeWorkbookJson,
  jsonBufferToSheets,
  parseWorkbookJsonRoot,
} from "../../lib/json-patch-template.js";
import { getUploadsDir } from "../../lib/uploads-dir.js";
import { resolvePathUnderUploadsRoot } from "../../lib/safe-upload-path.js";
import { sheetsToExcelBuffer } from "../../lib/sheets-to-excel.js";
import { sheetsToPreviewPayload } from "../../lib/sheet-preview.js";
import {
  decodeTemplateSnapshotToSheets,
  encodeTemplateSnapshotFromSheets,
} from "../../lib/yjs-template-snapshot.js";
import { patchTemplates, stages } from "../../db/schema.js";
import { uuidParam } from "../../schemas/api.js";
import {
  isExcelOoxmlTemplate,
  isPatchTemplateJsonFile,
  patchTemplateStorageExtension,
  stripPatchTemplateBasename,
} from "../../lib/upload-allowlists.js";
import {
  buildWorkbookJsonExportV1,
  safeDownloadBasename,
} from "../../lib/workbook-json-envelope.js";
import {
  templateCollabDocName,
  workbookSnapshotBufferForPersist,
} from "../../lib/yjs-collab-replace.js";

const MAX_BYTES = 10 * 1024 * 1024;
const JSON_SHEETS_BODY_LIMIT = 12 * 1024 * 1024;

const logPatchTemplates = createLogger("patch-templates");

const patchNameBody = z.object({
  name: z.string().min(1).max(200),
});

const duplicateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  stageId: z.string().uuid().optional(),
});

const blankTemplateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  stageId: z.string().uuid().optional(),
});

function invalidateAll() {
  broadcastInvalidate([
    ["patchTemplates"],
    ["patchTemplate"],
    ["patchTemplatePreview"],
    ["events"],
  ]);
}

function templateRowLooksLikeJson(row: {
  storageKey: string;
  mimeType: string;
  originalName: string;
}): boolean {
  const ext = path.extname(row.storageKey).toLowerCase();
  if (ext === ".json") return true;
  return isPatchTemplateJsonFile(row.originalName, row.mimeType);
}

async function sheetsFromTemplateUpload(
  buf: Buffer,
  filename: string | undefined,
  mime: string,
): Promise<Sheet[]> {
  if (isPatchTemplateJsonFile(filename, mime)) {
    return jsonBufferToSheets(buf);
  }
  if (isExcelOoxmlTemplate(filename, mime)) {
    return excelBufferToSheets(buf);
  }
  /** Multipart often drops extension or sends `text/plain` / `octet-stream` only. */
  if (bufferLooksLikeWorkbookJson(buf)) {
    return jsonBufferToSheets(buf);
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  ) {
    return excelBufferToSheets(buf);
  }
  throw new Error(
    "Unsupported file: upload Excel (.xlsx, .xlsm, .xltx, .xltm) or FortuneSheet JSON (.json)",
  );
}

function normalizedTemplateMime(
  filename: string | undefined,
  reported: string,
): string {
  if (isPatchTemplateJsonFile(filename, reported)) {
    return "application/json";
  }
  return reported || "application/octet-stream";
}

/** Disk extension when multipart filename/MIME are unreliable (JSON body often reported as `text/plain`). */
function storageExtensionForTemplateUpload(
  buf: Buffer,
  filename: string | undefined,
  mime: string,
): string {
  if (isPatchTemplateJsonFile(filename, mime) || bufferLooksLikeWorkbookJson(buf)) {
    return ".json";
  }
  return patchTemplateStorageExtension(filename);
}

async function loadSheetsForPatchTemplateRow(
  row: typeof patchTemplates.$inferSelect,
  uploadsRoot: string,
): Promise<Sheet[]> {
  const fromYjs = decodeTemplateSnapshotToSheets(Buffer.from(row.snapshot));
  if (fromYjs.length > 0) return fromYjs;
  try {
    const buf = await fs.readFile(resolvePathUnderUploadsRoot(uploadsRoot, row.storageKey));
    return templateRowLooksLikeJson(row)
      ? jsonBufferToSheets(buf)
      : await excelBufferToSheets(buf);
  } catch (err) {
    logPatchTemplates.warn(
      { err, templateId: row.id, storageKey: row.storageKey },
      "failed to load template file for sheets",
    );
    throw new Error("TEMPLATE_STORAGE_READ_FAILED");
  }
}

export const patchTemplatesRoutes: FastifyPluginAsync = async (app) => {
  const listQuery = z.object({
    stageId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  });

  app.get("/patch-templates", async (req) => {
    const { stageId, page, limit: pageLimit } = listQuery.parse(req.query);
    const offset = (page - 1) * pageLimit;
    const cols = {
      id: patchTemplates.id,
      name: patchTemplates.name,
      originalName: patchTemplates.originalName,
      byteSize: patchTemplates.byteSize,
      stageId: patchTemplates.stageId,
      createdAt: patchTemplates.createdAt,
      updatedAt: patchTemplates.updatedAt,
    };
    const where = stageId
      ? or(isNull(patchTemplates.stageId), eq(patchTemplates.stageId, stageId))
      : isNull(patchTemplates.stageId);
    const [countRow] = await db
      .select({ total: count() })
      .from(patchTemplates)
      .where(where);
    const total = Number(countRow?.total ?? 0);
    const rows = await db
      .select(cols)
      .from(patchTemplates)
      .where(where)
      .orderBy(desc(patchTemplates.createdAt))
      .limit(pageLimit)
      .offset(offset);
    const hasMore = offset + rows.length < total;
    return {
      patchTemplates: rows,
      total,
      page,
      limit: pageLimit,
      hasMore,
    };
  });

  app.post("/patch-templates/blank", async (req, reply) => {
    const body = blankTemplateBody.parse(req.body ?? {});
    const displayName = body.name?.trim() || "New template";
    const ownerStageId = body.stageId ?? null;
    if (ownerStageId) {
      const [st] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, ownerStageId)).limit(1);
      if (!st) return reply.code(400).send({ error: "ValidationError", message: "Unknown stage" });
    }
    const sheets = createDefaultPatchWorkbookSheets();
    const snapshot = encodeTemplateSnapshotFromSheets(sheets);
    const xlsxBuf = await sheetsToExcelBuffer(sheets);
    const uploadsRoot = getUploadsDir();
    const storageKey = `patch-templates/${randomUUID()}.xlsx`;
    const abs = resolvePathUnderUploadsRoot(uploadsRoot, storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, xlsxBuf);

    const [inserted] = await db
      .insert(patchTemplates)
      .values({
        name: displayName.slice(0, 200),
        originalName: "blank-template.xlsx",
        storageKey,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        byteSize: xlsxBuf.length,
        snapshot,
        stageId: ownerStageId,
      })
      .returning({ id: patchTemplates.id });

    invalidateAll();
    req.log.debug({ templateId: inserted?.id, stageId: ownerStageId }, "patch template created from blank");
    return reply.code(201).send({ patchTemplate: { id: inserted?.id } });
  });

  app.post(
    "/patch-templates/sheets-import",
    { bodyLimit: JSON_SHEETS_BODY_LIMIT },
    async (req, reply) => {
      const q = z
        .object({
          name: z.string().min(1).max(200).optional(),
          stageId: z.string().uuid().optional(),
        })
        .parse(req.query);
      const ownerStageId = q.stageId ?? null;
      if (ownerStageId) {
        const [st] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, ownerStageId)).limit(1);
        if (!st) return reply.code(400).send({ error: "ValidationError", message: "Unknown stage" });
      }
      let sheets: Sheet[];
      try {
        sheets = parseWorkbookJsonRoot(req.body);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Invalid workbook JSON";
        return reply.code(400).send({ error: "ValidationError", message: msg });
      }
      const displayName = q.name?.trim() || "Imported template";
      const snapshot = encodeTemplateSnapshotFromSheets(sheets);
      const uploadsRoot = getUploadsDir();
      const storageKey = `patch-templates/${randomUUID()}.json`;
      const abs = resolvePathUnderUploadsRoot(uploadsRoot, storageKey);
      const fileStr = JSON.stringify(
        buildWorkbookJsonExportV1(
          "patchTemplate",
          displayName,
          sheets,
          {},
        ),
        null,
        2,
      );
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, fileStr, "utf8");
      const byteSize = Buffer.byteLength(fileStr, "utf8");

      const [inserted] = await db
        .insert(patchTemplates)
        .values({
          name: displayName.slice(0, 200),
          originalName: "workbook-import.json",
          storageKey,
          mimeType: "application/json",
          byteSize,
          snapshot,
          stageId: ownerStageId,
        })
        .returning({ id: patchTemplates.id });

      invalidateAll();
      req.log.debug(
        { templateId: inserted?.id, stageId: ownerStageId },
        "patch template created from JSON body",
      );
      return reply.code(201).send({ patchTemplate: { id: inserted?.id } });
    },
  );

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

    return {
      patchTemplate: {
        id: row.id,
        name: row.name,
        originalName: row.originalName,
        byteSize: row.byteSize,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        usedByStageCount: Number(usage?.c ?? 0),
      },
    };
  });

  app.get("/patch-templates/:id/sheets-export", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    const uploadsRoot = getUploadsDir();
    let sheets: Sheet[];
    try {
      sheets = await loadSheetsForPatchTemplateRow(row, uploadsRoot);
    } catch {
      return reply.code(503).send({
        error: "ServiceUnavailable",
        message:
          "Could not load this template from storage. Try re-uploading the file in Settings or contact an administrator.",
      });
    }
    if (sheets.length === 0) {
      return reply.code(404).send({
        error: "NotFound",
        message: "No sheet data in this template",
      });
    }
    const payload = buildWorkbookJsonExportV1(
      "patchTemplate",
      row.name,
      sheets,
      { templateId: id },
    );
    const fname = safeDownloadBasename(row.name, "patch-template");
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${fname}_workbook.json"`,
    );
    req.log.debug({ templateId: id }, "patch template workbook exported");
    return reply.send(JSON.stringify(payload, null, 2));
  });

  app.put(
    "/patch-templates/:id/sheets-import",
    { bodyLimit: JSON_SHEETS_BODY_LIMIT },
    async (req, reply) => {
      const { id } = uuidParam.parse(req.params);
      const [existing] = await db
        .select()
        .from(patchTemplates)
        .where(eq(patchTemplates.id, id));
      if (!existing) return reply.code(404).send({ error: "NotFound" });

      let sheets: Sheet[];
      try {
        sheets = parseWorkbookJsonRoot(req.body);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Invalid workbook JSON";
        return reply.code(400).send({ error: "ValidationError", message: msg });
      }

      const docName = templateCollabDocName(id);
      const snapshot = workbookSnapshotBufferForPersist(docName, sheets);
      const uploadsRoot = getUploadsDir();
      const oldAbs = resolvePathUnderUploadsRoot(uploadsRoot, existing.storageKey);
      const storageKey = `patch-templates/${randomUUID()}.json`;
      const abs = resolvePathUnderUploadsRoot(uploadsRoot, storageKey);
      const fileStr = JSON.stringify(
        buildWorkbookJsonExportV1(
          "patchTemplate",
          existing.name,
          sheets,
          { templateId: id },
        ),
        null,
        2,
      );
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, fileStr, "utf8");
      const byteSize = Buffer.byteLength(fileStr, "utf8");

      try {
        await db
          .update(patchTemplates)
          .set({
            storageKey,
            mimeType: "application/json",
            byteSize,
            snapshot,
            originalName: "workbook-import.json",
            updatedAt: new Date(),
          })
          .where(eq(patchTemplates.id, id));
      } catch (e) {
        await fs.unlink(abs).catch(() => {});
        throw e;
      }

      try {
        await fs.unlink(oldAbs);
      } catch {
        /* ignore */
      }

      invalidateAll();
      req.log.debug({ templateId: id }, "patch template workbook replaced from JSON");
      return { ok: true };
    },
  );

  app.get("/patch-templates/:id/preview", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    const uploadsRoot = getUploadsDir();
    let sheets: Sheet[];
    try {
      sheets = await loadSheetsForPatchTemplateRow(row, uploadsRoot);
    } catch {
      return reply.code(503).send({
        error: "ServiceUnavailable",
        message:
          "Could not load this template from storage. Try re-uploading the file in Settings or contact an administrator.",
      });
    }
    return sheetsToPreviewPayload(sheets);
  });

  app.post(
    "/patch-templates",
    {
      config: {
        rateLimit: {
          max: 40,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
    const q = z
      .object({
        name: z.string().min(1).max(200).optional(),
        stageId: z.string().uuid().optional(),
      })
      .parse(req.query);
    const ownerStageId = q.stageId ?? null;
    if (ownerStageId) {
      const [st] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, ownerStageId)).limit(1);
      if (!st) return reply.code(400).send({ error: "ValidationError", message: "Unknown stage" });
    }
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
      (filename ? stripPatchTemplateBasename(filename).trim() : "") ||
      "Template";
    if (buf.length === 0) {
      return reply.code(400).send({ error: "ValidationError", message: "Empty file" });
    }
    if (buf.length > MAX_BYTES) {
      return reply.code(413).send({ error: "PayloadTooLarge" });
    }
    let sheets: Sheet[];
    try {
      sheets = await sheetsFromTemplateUpload(buf, filename, mime);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Invalid template file";
      return reply.code(400).send({ error: "ValidationError", message: msg });
    }
    const snapshot = encodeTemplateSnapshotFromSheets(sheets);
    const uploadsRoot = getUploadsDir();
    const tmplExt = storageExtensionForTemplateUpload(buf, filename, mime);
    const storageKey = `patch-templates/${randomUUID()}${tmplExt}`;
    const abs = resolvePathUnderUploadsRoot(uploadsRoot, storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);
    const storedMime =
      tmplExt === ".json"
        ? "application/json"
        : normalizedTemplateMime(filename, mime);

    const [inserted] = await db
      .insert(patchTemplates)
      .values({
        name: displayName,
        originalName: filename || `template${tmplExt}`,
        storageKey,
        mimeType: storedMime,
        byteSize: buf.length,
        snapshot,
        stageId: ownerStageId,
      })
      .returning({ id: patchTemplates.id });

    invalidateAll();
    req.log.debug(
      {
        templateId: inserted?.id,
        stageId: ownerStageId,
        format: tmplExt === ".json" ? "json" : "excel",
      },
      "patch template created",
    );
    return reply.code(201).send({ patchTemplate: { id: inserted?.id } });
    },
  );

  app.post("/patch-templates/:id/duplicate", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = duplicateBody.parse(req.body ?? {});
    const ownerStageId = body.stageId ?? null;
    if (ownerStageId) {
      const [st] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, ownerStageId)).limit(1);
      if (!st) return reply.code(400).send({ error: "ValidationError", message: "Unknown stage" });
    }
    const [existing] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    const uploadsRoot = getUploadsDir();
    const srcAbs = resolvePathUnderUploadsRoot(uploadsRoot, existing.storageKey);
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
    const dstAbs = resolvePathUnderUploadsRoot(uploadsRoot, newStorageKey);
    await fs.mkdir(path.dirname(dstAbs), { recursive: true });
    await fs.writeFile(dstAbs, fileBuf);

    const base =
      body.name?.trim() ||
      `${existing.name} (copy)`.trim().slice(0, 200) ||
      "Copy";
    const displayName = base.slice(0, 200);

    let inserted: { id: string } | undefined;
    try {
      const [row] = await db
        .insert(patchTemplates)
        .values({
          name: displayName,
          originalName: existing.originalName,
          storageKey: newStorageKey,
          mimeType: existing.mimeType,
          byteSize: existing.byteSize,
          snapshot: existing.snapshot,
          stageId: ownerStageId,
        })
        .returning({ id: patchTemplates.id });
      inserted = row;
    } catch (e) {
      await fs.unlink(dstAbs).catch(() => {});
      throw e;
    }

    invalidateAll();
    req.log.info(
      { templateId: inserted?.id, sourceTemplateId: id, stageId: ownerStageId },
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

  app.post(
    "/patch-templates/:id/replace",
    {
      config: {
        rateLimit: {
          max: 40,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
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
    let sheets: Sheet[];
    try {
      sheets = await sheetsFromTemplateUpload(buf, filename, mime);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Invalid template file";
      return reply.code(400).send({ error: "ValidationError", message: msg });
    }
    const docName = templateCollabDocName(id);
    const snapshot = workbookSnapshotBufferForPersist(docName, sheets);
    const uploadsRoot = getUploadsDir();
    const oldAbs = resolvePathUnderUploadsRoot(uploadsRoot, existing.storageKey);
    const tmplExt = storageExtensionForTemplateUpload(buf, filename, mime);
    const storageKey = `patch-templates/${randomUUID()}${tmplExt}`;
    const abs = resolvePathUnderUploadsRoot(uploadsRoot, storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);
    const storedMime =
      tmplExt === ".json"
        ? "application/json"
        : normalizedTemplateMime(filename, mime);

    try {
      await db
        .update(patchTemplates)
        .set({
          originalName: filename || existing.originalName,
          storageKey,
          mimeType: storedMime,
          byteSize: buf.length,
          snapshot,
          updatedAt: new Date(),
        })
        .where(eq(patchTemplates.id, id));
    } catch (e) {
      await fs.unlink(abs).catch(() => {});
      throw e;
    }

    try {
      await fs.unlink(oldAbs);
    } catch {
      /* ignore */
    }

    invalidateAll();
    req.log.info({ templateId: id }, "patch template file replaced");
    return { ok: true };
    },
  );

  app.delete("/patch-templates/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [existing] = await db
      .select()
      .from(patchTemplates)
      .where(eq(patchTemplates.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    const uploadsRoot = getUploadsDir();
    try {
      await fs.unlink(resolvePathUnderUploadsRoot(uploadsRoot, existing.storageKey));
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
