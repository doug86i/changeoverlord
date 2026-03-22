import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const execFileAsync = promisify(execFile);

export type ConvertStrategy = "imagemagick" | "libreoffice" | "pdf-lib-text";

const OFFICE_EXT = new Set([".doc", ".docx", ".odt", ".rtf"]);
const TEXT_EXT = new Set([".txt", ".md", ".csv"]);
const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
]);

export function getConvertStrategy(
  mimeType: string,
  originalName: string,
): ConvertStrategy | null {
  const m = (mimeType || "").toLowerCase();
  const ext = path.extname(originalName || "").toLowerCase();
  if (m === "application/pdf" || ext === ".pdf") return null;

  const looksImage =
    m.startsWith("image/") || IMAGE_EXT.has(ext);
  if (looksImage) return "imagemagick";

  const looksOffice =
    m === "application/msword" ||
    m ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    m === "application/vnd.oasis.opendocument.text" ||
    m === "application/rtf" ||
    m === "text/rtf" ||
    OFFICE_EXT.has(ext);
  if (looksOffice) return "libreoffice";

  const looksText =
    m === "text/plain" ||
    m === "text/markdown" ||
    m === "text/csv" ||
    TEXT_EXT.has(ext);
  if (looksText) return "pdf-lib-text";

  return null;
}

export function canConvertToPdf(mimeType: string, originalName: string): boolean {
  return getConvertStrategy(mimeType, originalName) !== null;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const FONT_SIZE = 10;
const LINE_H = FONT_SIZE * 1.25;
const CHARS_PER_LINE = 92;

function wrapPlainText(text: string): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n/g, "\n").split("\n")) {
    let rest = para;
    while (rest.length > CHARS_PER_LINE) {
      out.push(rest.slice(0, CHARS_PER_LINE));
      rest = rest.slice(CHARS_PER_LINE);
    }
    out.push(rest);
  }
  return out;
}

async function textFileToPdfBytes(buf: Buffer): Promise<Buffer> {
  const text = buf.toString("utf8");
  const lines = wrapPlainText(text);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  for (const line of lines) {
    if (y < MARGIN + LINE_H) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    page.drawText(line || " ", {
      x: MARGIN,
      y,
      font,
      size: FONT_SIZE,
      color: rgb(0, 0, 0),
    });
    y -= LINE_H;
  }
  return Buffer.from(await pdf.save());
}

function execErrorDetail(e: unknown): string {
  const err = e as NodeJS.ErrnoException & { stderr?: Buffer };
  const tail = err.stderr?.toString("utf8").trim().slice(-800);
  if (tail) return tail;
  return err.message || String(e);
}

async function imageToPdfWithMagick(inputPath: string, outputPdf: string): Promise<void> {
  const opts = { timeout: 120_000, maxBuffer: 50 * 1024 * 1024 } as const;
  let magickErr: unknown;
  try {
    await execFileAsync("magick", [inputPath, outputPdf], opts);
    return;
  } catch (e) {
    magickErr = e;
  }
  try {
    await execFileAsync("convert", [inputPath, outputPdf], opts);
  } catch (e2) {
    throw new Error(
      `ImageMagick could not create PDF (magick: ${execErrorDetail(magickErr)}; convert: ${execErrorDetail(e2)})`,
    );
  }
}

/**
 * JPEG/PNG → single-page A4 PDF without ImageMagick (faster, no delegate issues).
 * Returns null for other formats or if bytes are not a valid JPEG/PNG for pdf-lib.
 */
async function rasterImageToPdfWithPdfLib(
  buf: Buffer,
  mimeType: string,
  ext: string,
): Promise<Buffer | null> {
  const m = (mimeType || "").toLowerCase();
  const e = ext.toLowerCase();
  const isJpeg =
    m === "image/jpeg" ||
    m === "image/jpg" ||
    e === ".jpg" ||
    e === ".jpeg";
  const isPng = m === "image/png" || e === ".png";
  if (!isJpeg && !isPng) return null;

  let pdf: PDFDocument;
  let image: Awaited<ReturnType<PDFDocument["embedJpg"]>>;
  try {
    pdf = await PDFDocument.create();
    image = isJpeg ? await pdf.embedJpg(buf) : await pdf.embedPng(buf);
  } catch {
    return null;
  }

  const iw = image.width;
  const ih = image.height;
  const margin = 36;
  const maxW = PAGE_W - 2 * margin;
  const maxH = PAGE_H - 2 * margin;
  const scale = Math.min(maxW / iw, maxH / ih, 1);
  const w = iw * scale;
  const h = ih * scale;
  const x = (PAGE_W - w) / 2;
  const y = (PAGE_H - h) / 2;
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawImage(image, { x, y, width: w, height: h });
  return Buffer.from(await pdf.save());
}

async function officeToPdfWithLibreOffice(
  inputPath: string,
  outDir: string,
  tmpHome: string,
): Promise<string> {
  await execFileAsync(
    "libreoffice",
    ["--headless", "--convert-to", "pdf", "--outdir", outDir, inputPath],
    {
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        HOME: tmpHome,
        /** Avoid OpenCL/GPU assumptions in headless containers. */
        SAL_DISABLE_OPENCL: "1",
      },
    },
  );
  const base = path.basename(inputPath, path.extname(inputPath));
  return path.join(outDir, `${base}.pdf`);
}

/**
 * Convert a rider attachment to PDF (images, Word/ODT/RTF, plain text).
 * Caller must ensure the path is under the uploads directory.
 */
export async function convertFileToPdfBuffer(opts: {
  absPath: string;
  mimeType: string;
  originalName: string;
}): Promise<Buffer> {
  const strategy = getConvertStrategy(opts.mimeType, opts.originalName);
  if (!strategy) {
    throw new Error("This file type cannot be converted to PDF");
  }

  if (strategy === "pdf-lib-text") {
    const buf = await fs.readFile(opts.absPath);
    return textFileToPdfBytes(buf);
  }

  const workRoot = path.join(os.tmpdir(), `co-pdf-${randomUUID()}`);
  const outDir = path.join(workRoot, "out");
  const tmpHome = path.join(workRoot, "lo-home");
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(tmpHome, { recursive: true });

  const ext = path.extname(opts.originalName) || ".bin";
  const safeInput = path.join(workRoot, `source${ext}`);
  await fs.copyFile(opts.absPath, safeInput);

  try {
    if (strategy === "imagemagick") {
      const imageBuf = await fs.readFile(safeInput);
      const fromPdfLib = await rasterImageToPdfWithPdfLib(
        imageBuf,
        opts.mimeType,
        ext,
      );
      if (fromPdfLib) return fromPdfLib;

      const outPdf = path.join(outDir, "out.pdf");
      await imageToPdfWithMagick(safeInput, outPdf);
      return await fs.readFile(outPdf);
    }

    if (strategy === "libreoffice") {
      const pdfPath = await officeToPdfWithLibreOffice(safeInput, outDir, tmpHome);
      return await fs.readFile(pdfPath);
    }

    throw new Error("Unsupported conversion strategy");
  } finally {
    await fs.rm(workRoot, { recursive: true, force: true });
  }
}
