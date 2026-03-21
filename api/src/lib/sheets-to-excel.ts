import ExcelJS from "exceljs";
import type { Cell, CellMatrix, Sheet } from "@fortune-sheet/core";

function cellValue(cell: Cell | null): ExcelJS.CellValue | undefined {
  if (!cell) return undefined;
  if (cell.f != null && cell.f !== "") {
    return { formula: cell.f, result: cell.v };
  }
  if (cell.v !== undefined) return cell.v;
  return undefined;
}

/** Write FortuneSheet `Sheet[]` to an `.xlsx` buffer (for template storage / download). */
export async function sheetsToExcelBuffer(sheets: Sheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    const safeName = (sh.name || `Sheet${i + 1}`).slice(0, 31);
    const ws = wb.addWorksheet(safeName, {
      state: sh.hide === 1 ? "hidden" : "visible",
    });
    const matrix: CellMatrix = sh.data ?? [];
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r];
      for (let c = 0; c < row.length; c++) {
        const v = cellValue(row[c]);
        if (v === undefined) continue;
        ws.getRow(r + 1).getCell(c + 1).value = v;
      }
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
