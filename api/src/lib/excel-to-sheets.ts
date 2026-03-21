/* Library references `window.navigator.userAgent` for random ID generation — polyfill for Node. */
if (typeof globalThis.window === "undefined") {
  (globalThis as Record<string, unknown>).window = {
    navigator: { userAgent: "Node" },
    devicePixelRatio: 1,
  };
}

import { transformExcelToFortune } from "@zenmrp/fortune-sheet-excel";
import type { Cell, CellMatrix, Sheet } from "@fortune-sheet/core";

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

type SparseCell = { r: number; c: number; v: Cell | null };

/** Convert sparse `celldata` to dense `data` matrix (required by FortuneSheet's `applyOp`). */
function celldataToMatrix(
  celldata: SparseCell[],
  rows: number,
  cols: number,
): CellMatrix {
  const matrix: CellMatrix = Array.from({ length: rows }, () =>
    Array.from<Cell | null>({ length: cols }).fill(null),
  );
  for (const entry of celldata) {
    if (entry.r < rows && entry.c < cols && entry.v != null) {
      matrix[entry.r][entry.c] = entry.v;
    }
  }
  return matrix;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawFortuneSheet = Record<string, any>;

/** Extra sheet keys preserved for native JSON uploads (not used for Excel import). */
const NATIVE_JSON_SHEET_PASSTHROUGH: (keyof Sheet)[] = [
  "luckysheet_conditionformat_save",
  "luckysheet_alternateformat_save",
  "dataVerification",
  "filter",
  "filter_select",
  "frozen",
  "hyperlink",
  "showGridLines",
  "zoomRatio",
  "color",
  "pivotTable",
  "isPivotTable",
  "luckysheet_select_save",
  "luckysheet_selection_range",
  "dynamicArray_compute",
  "dynamicArray",
];

export type NormalizeSheetOptions = { nativeJson?: boolean };

/**
 * Build a clean FortuneSheet `Sheet` from raw workbook data.
 *
 * Excel import uses the default path (strict). Native JSON may pass through
 * additional fields FortuneSheet expects (conditional formatting, filters, etc.).
 */
export function normalizeSheetFromRaw(
  raw: RawFortuneSheet,
  order: number,
  opts?: NormalizeSheetOptions,
): Sheet {
  // Compute grid dimensions from celldata if not set.
  let rows = typeof raw.row === "number" ? raw.row : 0;
  let cols = typeof raw.column === "number" ? raw.column : 0;
  const celldata: SparseCell[] | undefined = raw.celldata;
  if ((!rows || !cols) && celldata) {
    let maxR = 0;
    let maxC = 0;
    for (const c of celldata) {
      if (c.r > maxR) maxR = c.r;
      if (c.c > maxC) maxC = c.c;
    }
    if (!rows) rows = maxR + 1;
    if (!cols) cols = maxC + 1;
  }
  rows = Math.max(rows, 36);
  cols = Math.max(cols, 18);

  // Convert sparse celldata → dense data matrix.
  const data: CellMatrix =
    raw.data ?? celldataToMatrix(celldata ?? [], rows, cols);

  const cfg = raw.config ?? {};

  const baseConfig = {
    ...(cfg.merge ? { merge: cfg.merge } : {}),
    ...(Array.isArray(cfg.borderInfo) && cfg.borderInfo.length
      ? { borderInfo: cfg.borderInfo }
      : {}),
    ...(cfg.rowlen ? { rowlen: cfg.rowlen } : {}),
    ...(cfg.columnlen ? { columnlen: cfg.columnlen } : {}),
    ...(cfg.rowhidden ? { rowhidden: cfg.rowhidden } : {}),
    ...(cfg.colhidden ? { colhidden: cfg.colhidden } : {}),
    ...(cfg.customHeight ? { customHeight: cfg.customHeight } : {}),
    ...(cfg.customWidth ? { customWidth: cfg.customWidth } : {}),
    ...(opts?.nativeJson && cfg.authority != null
      ? { authority: cfg.authority }
      : {}),
    ...(opts?.nativeJson && cfg.rowReadOnly != null
      ? { rowReadOnly: cfg.rowReadOnly }
      : {}),
    ...(opts?.nativeJson && cfg.colReadOnly != null
      ? { colReadOnly: cfg.colReadOnly }
      : {}),
  };

  const sheet: Sheet = {
    id: raw.id ?? crypto.randomUUID(),
    name: decodeHtmlEntities(String(raw.name ?? `Sheet${order + 1}`)),
    status: order === 0 ? 1 : 0,
    order,
    row: rows,
    column: cols,
    data,
    config: baseConfig,
    ...(typeof raw.defaultColWidth === "number"
      ? { defaultColWidth: raw.defaultColWidth }
      : {}),
    ...(typeof raw.defaultRowHeight === "number"
      ? { defaultRowHeight: raw.defaultRowHeight }
      : {}),
    ...(Array.isArray(raw.calcChain) && raw.calcChain.length
      ? { calcChain: raw.calcChain }
      : {}),
    ...(raw.hide === 1 ? { hide: 1 } : {}),
  };

  if (!opts?.nativeJson) return sheet;

  const extra: Partial<Sheet> = {};
  for (const key of NATIVE_JSON_SHEET_PASSTHROUGH) {
    if (raw[key] !== undefined) {
      (extra as Record<string, unknown>)[key] = raw[key];
    }
  }
  return { ...sheet, ...extra };
}

/**
 * Parse OOXML Excel (`.xlsx`, `.xltx`, `.xlsm`, `.xltm`, …) into FortuneSheet `Sheet[]`.
 *
 * Uses `@zenmrp/fortune-sheet-excel` which preserves cell styles, borders, number
 * formatting, formulas, column widths, row heights, and merged cells.
 */
export async function excelBufferToSheets(buffer: Buffer): Promise<Sheet[]> {
  const savedLog = console.log;
  try {
    // The library logs debug output during border parsing — suppress it.
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.log = () => {};
    // Type mismatch: library declares `File` but accepts `Buffer` at runtime.
    const result = await transformExcelToFortune(buffer as unknown as File);
    console.log = savedLog;

    const raw = result.sheets as unknown as RawFortuneSheet[];
    if (!raw || raw.length === 0) {
      throw new Error("Workbook has no sheets");
    }

    return raw.map((s, i) => normalizeSheetFromRaw(s, i));
  } catch (e) {
    console.log = savedLog;
    throw e;
  }
}
