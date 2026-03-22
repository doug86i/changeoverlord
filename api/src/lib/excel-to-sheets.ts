/* Library references `window.navigator.userAgent` for random ID generation — polyfill for Node. */
if (typeof globalThis.window === "undefined") {
  (globalThis as Record<string, unknown>).window = {
    navigator: { userAgent: "Node" },
    devicePixelRatio: 1,
  };
}

import { transformExcelToFortune } from "@zenmrp/fortune-sheet-excel";
import type { Cell, CellMatrix, Sheet } from "@fortune-sheet/core";
import { extractConditionalFormatting } from "./excel-cf-extract.js";

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

/**
 * FortuneSheet runtime compares `cell.tb` to string literals (`"1"`, `"2"`). Exports
 * often use numbers — coerce so wrap/text layout matches the grid engine.
 *
 * Merge **master** cells must include `mc.r` / `mc.c`; many JSON exports only set
 * `rs` / `cs`. Without anchors, core does `config.merge[undefined + "_" + undefined]`
 * and the workbook can throw during render.
 */
function sanitizeFortuneSheetDataMatrix(data: CellMatrix): void {
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell == null) continue;
      if (typeof cell.tb === "number") {
        (cell as { tb?: string }).tb = String(cell.tb);
      }
      const mc = cell.mc;
      if (mc != null && (mc.rs != null || mc.cs != null)) {
        if (mc.r == null || mc.c == null) {
          mc.r = r;
          mc.c = c;
        }
      }
    }
  }
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

type CalcChainEntry = { r: number; c: number; id: string; index: string };

/**
 * Build `calcChain` from existing chain or by scanning the data matrix.
 * FortuneSheet's incremental recalc (`execFunctionGroup`) only re-evaluates
 * formulas registered here — without entries, cell edits never trigger
 * formula updates.
 */
function buildCalcChain(
  raw: RawFortuneSheet,
  data: CellMatrix,
  resolvedSheetId: string,
): CalcChainEntry[] {
  const existing =
    Array.isArray(raw.calcChain) && raw.calcChain.length
      ? (raw.calcChain as CalcChainEntry[])
      : [];

  const seen = new Set<string>();
  const chain: CalcChainEntry[] = [];
  for (const e of existing) {
    seen.add(`${e.r},${e.c}`);
    const id =
      e.id != null && String(e.id).trim() !== ""
        ? String(e.id)
        : resolvedSheetId;
    const index =
      e.index != null && String(e.index).trim() !== ""
        ? String(e.index)
        : resolvedSheetId;
    chain.push({ ...e, r: e.r, c: e.c, id, index });
  }
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell?.f && !seen.has(`${r},${c}`)) {
        chain.push({ r, c, id: resolvedSheetId, index: resolvedSheetId });
      }
    }
  }
  return chain;
}

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
  sanitizeFortuneSheetDataMatrix(data);

  const cfg = raw.config ?? {};

  const trimmedRawId =
    raw.id != null && String(raw.id).trim() !== ""
      ? String(raw.id).trim()
      : "";
  /** `??` does not treat `""` as missing; Excel sometimes yields empty ids. */
  const resolvedId = trimmedRawId || crypto.randomUUID();

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
    id: resolvedId,
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
    calcChain: buildCalcChain(raw, data, resolvedId),
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
 *
 * Conditional formatting is extracted separately from the raw OOXML XML because
 * the library does not support it.
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

    const cfMap = await extractConditionalFormatting(buffer);

    return raw.map((s, i) => {
      const sheet = normalizeSheetFromRaw(s, i);
      const cf = cfMap.get(i);
      if (cf?.length) {
        (sheet as Record<string, unknown>).luckysheet_conditionformat_save = cf;
      }
      return sheet;
    });
  } catch (e) {
    console.log = savedLog;
    throw e;
  }
}
