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

async function imageToPdfWithMagick(inputPath: string, outputPdf: string): Promise<void> {
  try {
    await execFileAsync(
      "magick",
      [inputPath, outputPdf],
      { timeout: 120_000, maxBuffer: 50 * 1024 * 1024 },
    );
  } catch {
    await execFileAsync(
      "convert",
      [inputPath, outputPdf],
      { timeout: 120_000, maxBuffer: 50 * 1024 * 1024 },
    );
  }
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
