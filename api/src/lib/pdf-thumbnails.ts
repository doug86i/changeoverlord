import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getPdfPageCount } from "./pdf.js";

const execFileAsync = promisify(execFile);

/** Max pages to rasterize (UI only; extract still allows any valid index server-side). */
const MAX_PREVIEW_PAGES = 50;
const SCALE_TO_PX = 160;

/**
 * JPEG data URLs for each page (up to {@link MAX_PREVIEW_PAGES}), using system `pdftoppm` (Poppler).
 */
export async function renderPdfThumbnailsJpegDataUrls(
  pdfAbsPath: string,
): Promise<{ pageCount: number; thumbnails: string[] }> {
  const buf = await fs.readFile(pdfAbsPath);
  const pageCount = await getPdfPageCount(buf);
  if (pageCount < 1) {
    return { pageCount: 0, thumbnails: [] };
  }

  const lastPage = Math.min(pageCount, MAX_PREVIEW_PAGES);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-prev-"));
  const outBase = path.join(tmp, "thumb");

  try {
    await execFileAsync("pdftoppm", [
      "-jpeg",
      "-scale-to",
      String(SCALE_TO_PX),
      "-f",
      "1",
      "-l",
      String(lastPage),
      pdfAbsPath,
      outBase,
    ]);

    const entries = await fs.readdir(tmp);
    const jpgs = entries
      .filter((n) => n.startsWith("thumb-") && n.endsWith(".jpg"))
      .sort((a, b) => {
        const na = parseInt(/thumb-(\d+)\.jpg/.exec(a)?.[1] ?? "0", 10);
        const nb = parseInt(/thumb-(\d+)\.jpg/.exec(b)?.[1] ?? "0", 10);
        return na - nb;
      });

    const thumbnails: string[] = [];
    for (const name of jpgs) {
      const fileBuf = await fs.readFile(path.join(tmp, name));
      thumbnails.push(`data:image/jpeg;base64,${fileBuf.toString("base64")}`);
    }

    return { pageCount, thumbnails };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
