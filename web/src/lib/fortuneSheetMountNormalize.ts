import type { Cell, Sheet } from "@fortune-sheet/core";

type CelldataEntry = { r: number; c: number; v: Cell };

/**
 * FortuneSheet React's `initSheetData` (first mount) builds `sheet.data` only from `celldata`.
 * If `celldata` is absent, it allocates a default-sized matrix of nulls and **replaces** `data`,
 * wiping cells that exist only in the `data` matrix (our relay + Postgres shape).
 * See `Workbook` `useEffect` in `@fortune-sheet/react` when `luckysheetfile` is first filled.
 */
export function normalizeSheetForFortuneMount(sheet: Sheet): Sheet {
  const raw = sheet as Sheet & { celldata?: CelldataEntry[] | null };
  if (Array.isArray(raw.celldata) && raw.celldata.length > 0) {
    return sheet;
  }
  const data = sheet.data;
  if (!Array.isArray(data) || data.length === 0) {
    return sheet;
  }
  const celldata: CelldataEntry[] = [];
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v != null) {
        celldata.push({ r, c, v: v as Cell });
      }
    }
  }
  if (celldata.length === 0) {
    return sheet;
  }
  return { ...sheet, celldata };
}

export function normalizeSheetsForFortuneMount(sheets: Sheet[]): Sheet[] {
  return sheets.map((s) => normalizeSheetForFortuneMount(s));
}
