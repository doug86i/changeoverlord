import type { Cell, CellMatrix, Sheet } from "@fortune-sheet/core";

type CellValue = string | number | boolean | null;

function cellPreview(c: Cell | null | undefined): CellValue {
  if (c == null) return null;
  if (typeof c.v === "number" || typeof c.v === "boolean") return c.v;
  if (typeof c.v === "string") return c.v;
  return null;
}

/** Build a preview grid from either dense `data` or sparse `celldata`. */
function sampleGrid(
  sheet: Sheet,
  maxRows: number,
  maxCols: number,
): CellValue[][] {
  if (sheet.data?.length) {
    const out: CellValue[][] = [];
    for (let r = 0; r < Math.min(maxRows, sheet.data.length); r++) {
      const row = sheet.data[r];
      const line: CellValue[] = [];
      if (!row) { out.push(line); continue; }
      for (let c = 0; c < Math.min(maxCols, row.length); c++) {
        line.push(cellPreview(row[c]));
      }
      out.push(line);
    }
    return out;
  }

  if (sheet.celldata?.length) {
    const grid: CellValue[][] = Array.from({ length: maxRows }, () =>
      Array.from<CellValue>({ length: maxCols }).fill(null),
    );
    for (const entry of sheet.celldata as { r: number; c: number; v: Cell | null }[]) {
      if (entry.r < 0 || entry.c < 0) continue;
      if (entry.r < maxRows && entry.c < maxCols) {
        grid[entry.r][entry.c] = cellPreview(entry.v);
      }
    }
    return grid;
  }

  return [];
}

export function sheetsToPreviewPayload(sheets: Sheet[]) {
  return {
    sheets: sheets.map((s) => ({
      name: s.name,
      row: s.row,
      column: s.column,
      sample: sampleGrid(s, 8, 12),
    })),
  };
}
