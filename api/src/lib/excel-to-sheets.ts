import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import type { Cell, CellMatrix, Sheet } from "@fortune-sheet/core";

function cellToFortune(cell: ExcelJS.Cell): Cell | null {
  const v = cell.value;
  if (v == null || v === "") return null;
  if (typeof v === "number") return { v };
  if (typeof v === "string") return { v };
  if (typeof v === "boolean") return { v };
  if (typeof v === "object" && v !== null && "formula" in v) {
    const fv = v as ExcelJS.CellFormulaValue;
    const r = fv.result;
    if (r == null) return null;
    if (typeof r === "number")
      return { v: r, f: fv.formula != null ? String(fv.formula) : undefined };
    return { v: String(r), f: fv.formula != null ? String(fv.formula) : undefined };
  }
  if (typeof v === "object" && v !== null && "richText" in v) {
    const rt = (v as ExcelJS.CellRichTextValue).richText;
    const s = rt?.map((t) => t.text).join("") ?? "";
    return s ? { v: s } : null;
  }
  return { v: String(v) };
}

/** Parse OOXML Excel (`.xlsx`, `.xltx`, `.xlsm`, `.xltm`, …) into FortuneSheet `Sheet[]`. */
export async function excelBufferToSheets(buffer: Buffer): Promise<Sheet[]> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS `load` typings vs Node 22 `Buffer` — double cast at the library boundary.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const sheets: Sheet[] = [];
  let order = 0;
  workbook.eachSheet((ws) => {
    let maxR = 0;
    let maxC = 0;
    ws.eachRow((row, rowNumber) => {
      maxR = Math.max(maxR, rowNumber);
      row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
        maxC = Math.max(maxC, colNumber);
      });
    });
    const nRows = Math.max(maxR, 36);
    const nCols = Math.max(maxC, 18);
    const data: CellMatrix = [];
    for (let r = 0; r < nRows; r++) {
      const row: (Cell | null)[] = [];
      for (let c = 0; c < nCols; c++) {
        const cell = ws.getRow(r + 1).getCell(c + 1);
        row.push(cellToFortune(cell));
      }
      data.push(row);
    }
    sheets.push({
      id: randomUUID(),
      name: ws.name || `Sheet${order + 1}`,
      status: order === 0 ? 1 : 0,
      row: nRows,
      column: nCols,
      data,
      order: order++,
    });
  });
  if (sheets.length === 0) {
    throw new Error("Workbook has no sheets");
  }
  return sheets;
}
