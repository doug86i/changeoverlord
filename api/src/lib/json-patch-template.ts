import type { Sheet } from "@fortune-sheet/core";
import {
  normalizeSheetFromRaw,
  type RawFortuneSheet,
} from "./excel-to-sheets.js";

/** Matches practical library limits; aligned with template upload size cap. */
const MAX_TEMPLATE_SHEETS = 40;

function extractSheetArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.luckysheetfile)) return o.luckysheetfile;
    if (Array.isArray(o.sheets)) return o.sheets;
  }
  throw new Error(
    'JSON root must be a sheet array, or an object with "sheets" or "luckysheetfile"',
  );
}

/**
 * Parse an already-parsed JSON value into `Sheet[]` (multipart upload, REST body, CLI).
 * Accepts the same shapes as file upload: sheet array, `{ sheets }`, `{ luckysheetfile }`,
 * or **`{ changeoverlordWorkbook: 1, sheets: [...] }`** export envelope.
 */
export function parseWorkbookJsonRoot(parsed: unknown): Sheet[] {
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (
      o.changeoverlordWorkbook === 1 &&
      Array.isArray(o.sheets)
    ) {
      parsed = { sheets: o.sheets };
    }
  }
  const rawSheets = extractSheetArray(parsed);
  if (rawSheets.length === 0) {
    throw new Error("Workbook has no sheets");
  }
  if (rawSheets.length > MAX_TEMPLATE_SHEETS) {
    throw new Error(`Too many sheets (max ${MAX_TEMPLATE_SHEETS})`);
  }
  return rawSheets.map((s, i) => {
    if (!s || typeof s !== "object") {
      throw new Error(`Invalid sheet at index ${i}`);
    }
    return normalizeSheetFromRaw(s as RawFortuneSheet, i, {
      nativeJson: true,
    });
  });
}

/**
 * Parse a UTF-8 JSON workbook into FortuneSheet `Sheet[]` for template upload.
 * Preserves native fields (conditional formatting, data validation, etc.) via
 * `normalizeSheetFromRaw(..., { nativeJson: true })`.
 */
export function jsonBufferToSheets(buffer: Buffer): Sheet[] {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Invalid JSON");
  }
  return parseWorkbookJsonRoot(parsed);
}

/** True when the buffer starts (after BOM / whitespace) with `{` or `[` — workbook JSON over multipart often lacks a useful filename or MIME. */
export function bufferLooksLikeWorkbookJson(buf: Buffer): boolean {
  let i = 0;
  if (
    buf.length >= 3 &&
    buf[0] === 0xef &&
    buf[1] === 0xbb &&
    buf[2] === 0xbf
  ) {
    i = 3;
  }
  for (; i < buf.length; i++) {
    const b = buf[i]!;
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) continue;
    break;
  }
  if (i >= buf.length) return false;
  const b = buf[i]!;
  return b === 0x7b || b === 0x5b;
}
