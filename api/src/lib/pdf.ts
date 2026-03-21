import { PDFDocument } from "pdf-lib";

function isPdfMagic(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

export async function getPdfPageCount(buf: Buffer): Promise<number> {
  if (!isPdfMagic(buf)) {
    throw new Error("Not a PDF file");
  }
  const doc = await PDFDocument.load(buf);
  return doc.getPageCount();
}

/** 0-based page index. */
export async function extractPdfPageToBuffer(
  buf: Buffer,
  pageIndex: number,
): Promise<Buffer> {
  if (!isPdfMagic(buf)) {
    throw new Error("Not a PDF file");
  }
  const src = await PDFDocument.load(buf);
  const n = src.getPageCount();
  if (pageIndex < 0 || pageIndex >= n) {
    throw new Error(`pageIndex out of range (0..${n - 1})`);
  }
  const out = await PDFDocument.create();
  const [copied] = await out.copyPages(src, [pageIndex]);
  out.addPage(copied);
  return Buffer.from(await out.save());
}
