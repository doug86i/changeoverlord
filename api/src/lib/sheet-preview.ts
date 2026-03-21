import type { Cell, CellMatrix, Sheet } from "@fortune-sheet/core";

function cellPreview(c: Cell | null | undefined): string | number | boolean | null {
  if (c == null) return null;
  if (typeof c.v === "number" || typeof c.v === "boolean") return c.v;
  if (typeof c.v === "string") return c.v;
  return null;
}

/** First `maxRows` × `maxCols` of a sheet for API preview JSON. */
export function sampleSheetData(
  data: CellMatrix | undefined,
  maxRows: number,
  maxCols: number,
): (string | number | boolean | null)[][] {
  if (!data?.length) return [];
  const out: (string | number | boolean | null)[][] = [];
  for (let r = 0; r < Math.min(maxRows, data.length); r++) {
    const row = data[r];
    const line: (string | number | boolean | null)[] = [];
    if (!row) {
      out.push(line);
      continue;
    }
    for (let c = 0; c < Math.min(maxCols, row.length); c++) {
      line.push(cellPreview(row[c]));
    }
    out.push(line);
  }
  return out;
}

export function sheetsToPreviewPayload(sheets: Sheet[]) {
  return {
    sheets: sheets.map((s) => ({
      name: s.name,
      row: s.row,
      column: s.column,
      sample: sampleSheetData(s.data, 8, 12),
    })),
  };
}
