import type { FastifyPluginAsync } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { broadcastInvalidate } from "../../lib/realtime-bus.js";
import { getUploadsDir } from "../../lib/uploads-dir.js";
import {
  extractPdfPageToBuffer,
  getPdfPageCount,
} from "../../lib/pdf.js";
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

const purposeEnum = z.enum([
  "rider_pdf",
  "plot_pdf",
  "plot_from_rider",
  "generic",
]);

const listQuery = z
  .object({
    stageId: z.string().uuid().optional(),
    performanceId: z.string().uuid().optional(),
  })
  .refine((q) => q.stageId || q.performanceId, {
    message: "stageId or performanceId required",
  });

const uploadQuery = z
  .object({
    stageId: z.string().uuid().optional(),
    performanceId: z.string().uuid().optional(),
    purpose: purposeEnum.default("rider_pdf"),
  })
  .refine((q) => (q.stageId ? 1 : 0) + (q.performanceId ? 1 : 0) === 1, {
    message: "Provide exactly one of stageId or performanceId",
  });

const extractBody = z.object({
  pageIndex: z.number().int().min(0),
});

function safeFilename(name: string): string {
  return name.replace(/[^\w.\- ()]+/g, "_").slice(0, 200);
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
      return { files: rows };
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

    return { files: rows };
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
        purpose: q.purpose,
        stageId,
        performanceId,
        parentFileId: null,
      })
      .returning({
        id: fileAssets.id,
        originalName: fileAssets.originalName,
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
      file: {
        ...row,
        ...(pageCount != null ? { pageCount } : {}),
        createdAt: row.createdAt.toISOString(),
      },
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
      file: {
        id: row.id,
        originalName: row.originalName,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        purpose: row.purpose,
        stageId: row.stageId,
        performanceId: row.performanceId,
        parentFileId: row.parentFileId,
        createdAt: row.createdAt.toISOString(),
        pageCount,
      },
    };
  });

  app.get("/files/:id/raw", async (req, reply) => {
    const { id } = uuidParam.parse(req.params);
    const [row] = await db.select().from(fileAssets).where(eq(fileAssets.id, id));
    if (!row) return reply.code(404).send({ error: "NotFound" });
    const abs = path.join(getUploadsDir(), row.storageKey);
    const buf = await fs.readFile(abs);
    return reply
      .header("Content-Type", row.mimeType)
      .header(
        "Content-Disposition",
        `inline; filename="${safeFilename(row.originalName)}"`,
      )
      .send(buf);
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
        purpose: "plot_from_rider",
        stageId: parent.stageId,
        performanceId: parent.performanceId,
        parentFileId: parent.id,
      })
      .returning({
        id: fileAssets.id,
        originalName: fileAssets.originalName,
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

    req.log.debug(
      {
        fileId: row.id,
        parentId: parent.id,
        pageIndex: body.pageIndex,
      },
      "pdf page extracted",
    );

    return reply.code(201).send({
      file: {
        ...row,
        createdAt: row.createdAt.toISOString(),
      },
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
