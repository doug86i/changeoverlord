import type { FastifyPluginAsync } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { getUploadsDir } from "../../lib/uploads-dir.js";
import {
  extractPdfPageToBuffer,
  getPdfPageCount,
} from "../../lib/pdf.js";
import { renderPdfThumbnailsJpegDataUrls } from "../../lib/pdf-thumbnails.js";
import {
  canConvertToPdf as fileCanConvertToPdf,
  convertFileToPdfBuffer,
} from "../../lib/convert-to-pdf.js";
import {
  isAllowedRiderAttachment,
  normalizeRiderMime,
  riderStorageExtension,
} from "../../lib/upload-allowlists.js";
import {
  fileAssets,
  performances,
  stageDays,
  stages,
} from "../../db/schema.js";
import { uuidParam } from "../../schemas/api.js";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

const purposeEnum = z.enum(["rider_pdf", "plot_pdf", "generic"]);

const listQuery = z
  .object({
    stageId: z.string().uuid().optional(),
    performanceId: z.string().uuid().optional(),
  })
  .refine((q) => Boolean(q.stageId) !== Boolean(q.performanceId), {
    message: "Provide exactly one of stageId or performanceId",
  });

const uploadQuery = z
  .object({
    stageId: z.string().uuid().optional(),
    performanceId: z.string().uuid().optional(),
  })
  .refine((q) => (q.stageId ? 1 : 0) + (q.performanceId ? 1 : 0) === 1, {
    message: "Provide exactly one of stageId or performanceId",
  });

const extractBody = z.object({
  pageIndex: z.number().int().min(0),
});

const patchFileBody = z.object({
  purpose: purposeEnum,
});

function safeFilename(name: string): string {
  return name.replace(/[^\w.\- ()]+/g, "_").slice(0, 200);
}

function toFileJson(
  row: {
    id: string;
    originalName: string;
    mimeType: string;
    byteSize: number;
    purpose: string;
    stageId: string | null;
    performanceId: string | null;
    parentFileId: string | null;
    createdAt: Date;
  },
  extra?: { pageCount?: number },
) {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    purpose: row.purpose,
    stageId: row.stageId,
    performanceId: row.performanceId,
    parentFileId: row.parentFileId,
    createdAt: row.createdAt.toISOString(),
    canConvertToPdf: fileCanConvertToPdf(row.mimeType, row.originalName),
    ...(extra ?? {}),
  };
}

async function resolvePerformanceStageId(
  performanceId: string,
): Promise<string | null> {
  const [perf] = await db
    .select({ stageDayId: performances.stageDayId })
    .from(performances)
    .where(eq(performances.id, performanceId))
    .limit(1);
  if (!perf) return null;
  const [day] = await db
    .select({ stageId: stageDays.stageId })
    .from(stageDays)
    .where(eq(stageDays.id, perf.stageDayId))
    .limit(1);
  return day?.stageId ?? null;
}

function invalidateFileQueries(stageId: string, performanceId: string | null) {
  const keys: (string | null)[][] = [
    ["stage", stageId],
    ["files", stageId],
  ];
  if (performanceId) {
    keys.push(["performance", performanceId], ["files", "performance", performanceId]);
  }
  broadcastInvalidate(keys);
}

function isPlotPurpose(purpose: string): boolean {
  return purpose === "plot_pdf";
}

function isRiderPurpose(purpose: string): boolean {
  return purpose === "rider_pdf";
}

/** At most one plot per scope (stage row or performance row). Demote others to `generic`. */
async function demoteOtherPlotsInScope(
  stageId: string,
  performanceId: string | null,
  exceptFileId: string,
): Promise<void> {
  const scope =
    performanceId === null
      ? and(eq(fileAssets.stageId, stageId), isNull(fileAssets.performanceId))
      : and(eq(fileAssets.stageId, stageId), eq(fileAssets.performanceId, performanceId));

  await db
    .update(fileAssets)
    .set({ purpose: "generic" })
    .where(
      and(
        scope,
        ne(fileAssets.id, exceptFileId),
        eq(fileAssets.purpose, "plot_pdf"),
      ),
    );
}

/** At most one rider per scope. Demote others to `generic`. */
async function demoteOtherRidersInScope(
  stageId: string,
  performanceId: string | null,
  exceptFileId: string,
): Promise<void> {
  const scope =
    performanceId === null
      ? and(eq(fileAssets.stageId, stageId), isNull(fileAssets.performanceId))
      : and(eq(fileAssets.stageId, stageId), eq(fileAssets.performanceId, performanceId));

  await db
    .update(fileAssets)
    .set({ purpose: "generic" })
    .where(
      and(
        scope,
        ne(fileAssets.id, exceptFileId),
        eq(fileAssets.purpose, "rider_pdf"),
      ),
    );
}

export const filesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/files", async (req, reply) => {
    const q = listQuery.parse(req.query);

    if (q.performanceId) {
      const rows = await db
        .select({
          id: fileAssets.id,
          originalName: fileAssets.originalName,
          mimeType: fileAssets.mimeType,
          byteSize: fileAssets.byteSize,
          purpose: fileAssets.purpose,
          stageId: fileAssets.stageId,
          performanceId: fileAssets.performanceId,
          parentFileId: fileAssets.parentFileId,
          createdAt: fileAssets.createdAt,
        })
        .from(fileAssets)
        .where(eq(fileAssets.performanceId, q.performanceId))
        .orderBy(desc(fileAssets.createdAt))
        .limit(200);
      return { files: rows.map((r) => toFileJson(r)) };
    }

    const rows = await db
      .select({
        id: fileAssets.id,
        originalName: fileAssets.originalName,
        mimeType: fileAssets.mimeType,
        byteSize: fileAssets.byteSize,
        purpose: fileAssets.purpose,
        stageId: fileAssets.stageId,
        performanceId: fileAssets.performanceId,
        parentFileId: fileAssets.parentFileId,
        createdAt: fileAssets.createdAt,
      })
      .from(fileAssets)
      .where(
        and(
          eq(fileAssets.stageId, q.stageId!),
          isNull(fileAssets.performanceId),
        ),
      )
      .orderBy(desc(fileAssets.createdAt))
      .limit(200);

    return { files: rows.map((r) => toFileJson(r)) };
  });

  app.post("/files", async (req, reply) => {
    const q = uploadQuery.parse(req.query);
    const mp = await req.file();
    if (!mp) {
      return reply.code(400).send({ error: "ValidationError", message: "file required" });
    }

    const buf = Buffer.from(await mp.toBuffer());
    if (buf.length > MAX_FILE_BYTES) {
      return reply.code(413).send({ error: "PayloadTooLarge" });
    }
    if (!isAllowedRiderAttachment(mp.filename, mp.mimetype || "")) {
      return reply.code(400).send({
        error: "ValidationError",
        message:
          "Unsupported file type. Use PDF, images, common text/doc formats, or similar.",
      });
    }

    const storedMime = normalizeRiderMime(mp.filename, mp.mimetype || "");
    const isPdf =
      storedMime === "application/pdf" ||
      mp.filename?.toLowerCase().endsWith(".pdf");

    let pageCount: number | undefined;
    if (isPdf) {
      try {
        pageCount = await getPdfPageCount(buf);
      } catch {
        return reply.code(400).send({
          error: "ValidationError",
          message: "Could not read PDF (invalid or encrypted file)",
        });
      }
    }

    let stageId: string;
    let performanceId: string | null = null;

    if (q.performanceId) {
      const sid = await resolvePerformanceStageId(q.performanceId);
      if (!sid) return reply.code(404).send({ error: "NotFound" });
      stageId = sid;
      performanceId = q.performanceId;
    } else {
      stageId = q.stageId!;
      const [stg] = await db
        .select({ id: stages.id })
        .from(stages)
        .where(eq(stages.id, stageId))
        .limit(1);
      if (!stg) return reply.code(404).send({ error: "NotFound" });
    }

    const ext = riderStorageExtension(mp.filename, mp.mimetype || "");
    const uploadsRoot = getUploadsDir();
    const storageKey = `files/${randomUUID()}${ext}`;
    const abs = path.join(uploadsRoot, storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);

    const [row] = await db
      .insert(fileAssets)
      .values({
        originalName: safeFilename(mp.filename || `upload${ext}`),
        storageKey,
        mimeType: storedMime,
        byteSize: buf.length,
        purpose: "generic",
        stageId,
        performanceId,
        parentFileId: null,
      })
      .returning({
        id: fileAssets.id,
        originalName: fileAssets.originalName,
        mimeType: fileAssets.mimeType,
        byteSize: fileAssets.byteSize,
        purpose: fileAssets.purpose,
        stageId: fileAssets.stageId,
        performanceId: fileAssets.performanceId,
        parentFileId: fileAssets.parentFileId,
        createdAt: fileAssets.createdAt,
      });

    invalidateFileQueries(stageId, performanceId);
    req.log.debug(
      { fileId: row.id, stageId, performanceId, pageCount },
      "file uploaded",
    );

    return reply.code(201).send({
      file: toFileJson(row, pageCount != null ? { pageCount } : undefined),
    });
  });

  app.get("/files/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db.select().from(fileAssets).where(eq(fileAssets.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    let pageCount: number | undefined;
    if (row.mimeType === "application/pdf") {
      try {
        const abs = path.join(getUploadsDir(), row.storageKey);
        const buf = await fs.readFile(abs);
        pageCount = await getPdfPageCount(buf);
      } catch {
        pageCount = undefined;
      }
    }
    return {
      file: toFileJson(row, pageCount != null ? { pageCount } : undefined),
    };
  });

  app.get("/files/:id/page-previews", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db.select().from(fileAssets).where(eq(fileAssets.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    if (row.mimeType !== "application/pdf") {
      return reply.code(400).send({
        error: "ValidationError",
        message: "Not a PDF",
      });
    }
    const abs = path.join(getUploadsDir(), row.storageKey);
    try {
      const { pageCount, thumbnails } = await renderPdfThumbnailsJpegDataUrls(abs);
      return { pageCount, thumbnails };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      req.log.warn({ fileId: id, err: msg }, "page previews failed");
      return reply.code(400).send({
        error: "ValidationError",
        message: "Could not build page previews (install poppler / check PDF)",
      });
    }
  });

  app.patch("/files/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = patchFileBody.parse(req.body);

    const [existing] = await db.select().from(fileAssets).where(eq(fileAssets.id, id));
    if (!existing) return reply.code(404).send({ error: "NotFound" });

    const [updated] = await db
      .update(fileAssets)
      .set({ purpose: body.purpose })
      .where(eq(fileAssets.id, id))
      .returning({
        id: fileAssets.id,
        originalName: fileAssets.originalName,
        mimeType: fileAssets.mimeType,
        byteSize: fileAssets.byteSize,
        purpose: fileAssets.purpose,
        stageId: fileAssets.stageId,
        performanceId: fileAssets.performanceId,
        parentFileId: fileAssets.parentFileId,
        createdAt: fileAssets.createdAt,
      });

    const row = updated!;
    if (row.stageId && isPlotPurpose(body.purpose)) {
      await demoteOtherPlotsInScope(row.stageId, row.performanceId, row.id);
    }

    if (row.stageId && isRiderPurpose(body.purpose)) {
      await demoteOtherRidersInScope(row.stageId, row.performanceId, row.id);
    }

    if (row.stageId) {
      invalidateFileQueries(row.stageId, row.performanceId);
    }

    req.log.debug({ fileId: id, purpose: row.purpose }, "file purpose updated");

    return {
      file: toFileJson(row),
    };
  });

  app.get("/files/:id/raw", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db.select().from(fileAssets).where(eq(fileAssets.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    const abs = path.join(getUploadsDir(), row.storageKey);
    let buf: Buffer;
    try {
      buf = await fs.readFile(abs);
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as NodeJS.ErrnoException).code) : "";
      if (code === "ENOENT") {
        req.log.warn({ id, storageKey: row.storageKey }, "file row exists but blob missing on disk");
        return reply.code(404).send({ error: "NotFound" });
      }
      throw e;
    }
    return reply
      .header("Content-Type", row.mimeType)
      .header(
        "Content-Disposition",
        `inline; filename="${safeFilename(row.originalName)}"`,
      )
      .send(buf);
  });

  app.post("/files/:id/convert-to-pdf", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [parent] = await db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, id));
    if (!parent) return reply.code(404).send({ error: "NotFound" });
    if (parent.mimeType === "application/pdf") {
      return reply.code(400).send({
        error: "ValidationError",
        message: "Already a PDF",
      });
    }
    if (!fileCanConvertToPdf(parent.mimeType, parent.originalName)) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "This file type cannot be converted to PDF here",
      });
    }

    const uploadsRoot = getUploadsDir();
    const parentAbs = path.join(uploadsRoot, parent.storageKey);
    let pdfBuf: Buffer;
    try {
      pdfBuf = await convertFileToPdfBuffer({
        absPath: parentAbs,
        mimeType: parent.mimeType,
        originalName: parent.originalName,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      req.log.warn({ fileId: id, err: msg }, "convert to pdf failed");
      return reply.code(400).send({
        error: "ValidationError",
        message: msg || "Could not convert to PDF",
      });
    }

    if (pdfBuf.length > MAX_FILE_BYTES) {
      return reply.code(413).send({ error: "PayloadTooLarge" });
    }

    let pageCount: number | undefined;
    try {
      pageCount = await getPdfPageCount(pdfBuf);
    } catch {
      pageCount = undefined;
    }

    const storageKey = `files/${randomUUID()}.pdf`;
    const abs = path.join(uploadsRoot, storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, pdfBuf);

    const baseStem = parent.originalName.replace(/\.[^.]+$/u, "") || "document";
    const [row] = await db
      .insert(fileAssets)
      .values({
        originalName: `${safeFilename(baseStem)}.pdf`,
        storageKey,
        mimeType: "application/pdf",
        byteSize: pdfBuf.length,
        purpose: "generic",
        stageId: parent.stageId,
        performanceId: parent.performanceId,
        parentFileId: parent.id,
      })
      .returning({
        id: fileAssets.id,
        originalName: fileAssets.originalName,
        mimeType: fileAssets.mimeType,
        byteSize: fileAssets.byteSize,
        purpose: fileAssets.purpose,
        stageId: fileAssets.stageId,
        performanceId: fileAssets.performanceId,
        parentFileId: fileAssets.parentFileId,
        createdAt: fileAssets.createdAt,
      });

    if (parent.stageId) {
      invalidateFileQueries(parent.stageId, parent.performanceId);
    }

    req.log.debug({ fileId: row.id, parentId: parent.id }, "converted to pdf");

    return reply.code(201).send({
      file: toFileJson(row, pageCount != null ? { pageCount } : undefined),
    });
  });

  app.post("/files/:id/extract-page", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const body = extractBody.parse(req.body);

    const [parent] = await db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, id));
    if (!parent) return reply.code(404).send({ error: "NotFound" });
    if (parent.mimeType !== "application/pdf") {
      return reply.code(400).send({
        error: "ValidationError",
        message: "Source must be a PDF",
      });
    }

    const uploadsRoot = getUploadsDir();
    const parentAbs = path.join(uploadsRoot, parent.storageKey);
    const parentBuf = await fs.readFile(parentAbs);

    let outBuf: Buffer;
    try {
      outBuf = await extractPdfPageToBuffer(parentBuf, body.pageIndex);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: "ValidationError", message: msg });
    }

    if (outBuf.length > MAX_FILE_BYTES) {
      return reply.code(413).send({ error: "PayloadTooLarge" });
    }

    const storageKey = `files/${randomUUID()}.pdf`;
    const abs = path.join(uploadsRoot, storageKey);
    await fs.writeFile(abs, outBuf);

    const baseName = parent.originalName.replace(/\.pdf$/i, "") || "page";
    const [row] = await db
      .insert(fileAssets)
      .values({
        originalName: `${baseName}-p${body.pageIndex + 1}.pdf`,
        storageKey,
        mimeType: "application/pdf",
        byteSize: outBuf.length,
        purpose: "plot_pdf",
        stageId: parent.stageId,
        performanceId: parent.performanceId,
        parentFileId: parent.id,
      })
      .returning({
        id: fileAssets.id,
        originalName: fileAssets.originalName,
        mimeType: fileAssets.mimeType,
        byteSize: fileAssets.byteSize,
        purpose: fileAssets.purpose,
        stageId: fileAssets.stageId,
        performanceId: fileAssets.performanceId,
        parentFileId: fileAssets.parentFileId,
        createdAt: fileAssets.createdAt,
      });

    if (parent.stageId) {
      await demoteOtherPlotsInScope(
        parent.stageId,
        parent.performanceId,
        row.id,
      );
      invalidateFileQueries(parent.stageId, parent.performanceId);
    }

    let pageCount: number | undefined;
    try {
      pageCount = await getPdfPageCount(outBuf);
    } catch {
      pageCount = undefined;
    }

    req.log.debug(
      {
        fileId: row.id,
        parentId: parent.id,
        pageIndex: body.pageIndex,
      },
      "pdf page extracted",
    );

    return reply.code(201).send({
      file: toFileJson(row, pageCount != null ? { pageCount } : undefined),
    });
  });

  app.delete("/files/:id", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db.select().from(fileAssets).where(eq(fileAssets.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });

    try {
      await fs.unlink(path.join(getUploadsDir(), row.storageKey));
    } catch {
      /* ignore missing file */
    }

    await db.delete(fileAssets).where(eq(fileAssets.id, id));

    if (row.stageId) {
      invalidateFileQueries(row.stageId, row.performanceId);
    }

    req.log.debug({ fileId: id }, "file deleted");
    return reply.code(204).send();
  });
};
