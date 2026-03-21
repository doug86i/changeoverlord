import path from "node:path";

/** OOXML spreadsheet formats ExcelJS can load via `workbook.xlsx.load`. */
const EXCEL_OOXML_EXT = new Set([
  ".xlsx",
  ".xlsm",
  ".xltx",
  ".xltm",
]);

const EXCEL_OOXML_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "application/vnd.ms-excel.template.macroEnabled.12",
  /** Some browsers / exports */
  "application/vnd.ms-excel",
]);

export function isExcelOoxmlTemplate(
  filename: string | undefined,
  mimetype: string,
): boolean {
  const ext = path.extname(filename || "").toLowerCase();
  if (EXCEL_OOXML_EXT.has(ext)) return true;
  const m = (mimetype || "").toLowerCase();
  if (EXCEL_OOXML_MIME.has(m)) return true;
  return false;
}

/** Extension for stored blob (preserves macro/template kinds when possible). */
export function excelTemplateStorageExtension(
  filename: string | undefined,
): string {
  const ext = path.extname(filename || "").toLowerCase();
  if (EXCEL_OOXML_EXT.has(ext)) return ext;
  return ".xlsx";
}

export function stripExcelTemplateBasename(name: string): string {
  return name.replace(/\.(xlsx|xlsm|xltx|xltm)$/i, "").trim();
}

const RIDER_EXT = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".txt",
  ".md",
  ".csv",
  ".doc",
  ".docx",
  ".odt",
  ".rtf",
]);

const RIDER_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
]);

const EXT_FALLBACK_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".rtf": "application/rtf",
};

export function isAllowedRiderAttachment(
  filename: string | undefined,
  mimetype: string,
): boolean {
  const ext = path.extname(filename || "").toLowerCase();
  const m = (mimetype || "").toLowerCase();
  if (m === "application/octet-stream" || m === "") {
    return RIDER_EXT.has(ext);
  }
  if (RIDER_MIME.has(m)) return true;
  if (RIDER_EXT.has(ext)) return true;
  return false;
}

export function riderStorageExtension(
  filename: string | undefined,
  mimetype: string,
): string {
  const ext = path.extname(filename || "").toLowerCase();
  if (ext && RIDER_EXT.has(ext)) return ext;
  const m = (mimetype || "").toLowerCase();
  if (m === "application/pdf") return ".pdf";
  if (m.startsWith("image/")) {
    if (m === "image/jpeg") return ".jpg";
    if (m === "image/tiff") return ".tif";
    return `.${m.slice("image/".length)}`;
  }
  if (m === "text/plain") return ".txt";
  if (m === "text/markdown") return ".md";
  if (m === "text/csv") return ".csv";
  if (
    m ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return ".docx";
  if (m === "application/vnd.oasis.opendocument.text") return ".odt";
  if (m === "application/msword") return ".doc";
  if (m === "application/rtf" || m === "text/rtf") return ".rtf";
  return ".bin";
}

export function normalizeRiderMime(
  filename: string | undefined,
  reported: string,
): string {
  const ext = path.extname(filename || "").toLowerCase();
  if (ext && EXT_FALLBACK_MIME[ext]) {
    const r = (reported || "").toLowerCase();
    if (!r || r === "application/octet-stream") return EXT_FALLBACK_MIME[ext]!;
    return reported;
  }
  return reported || "application/octet-stream";
}
