import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import type { Cell, CellMatrix, Sheet } from "@fortune-sheet/core";

/** Matches FortuneSheet’s in-sheet data verification shape (see `dataVerification.d.ts` / react toolbar defaults). */
type FortuneDataVerificationItem = {
  type: "dropdown";
  type2: string;
  value1: string;
  value2: string;
  validity: string;
  remote: boolean;
  prohibitInput: boolean;
  hintShow: boolean;
  hintValue: string;
};

function columnLettersToIndex(letters: string): number {
  let col = 0;
  const L = letters.toUpperCase();
  for (let i = 0; i < L.length; i++) {
    col = col * 26 + (L.charCodeAt(i) - 64);
  }
  return col - 1;
}

function parseExcelCellRef(ref: string): { r: number; c: number } | null {
  const clean = ref.replace(/\$/g, "").trim();
  const m = clean.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  return {
    r: parseInt(m[2], 10) - 1,
    c: columnLettersToIndex(m[1]),
  };
}

/** Expand Excel model keys such as `B1` or `B2:B10` to 0-based cell coordinates. */
function expandExcelRangeKey(key: string): { r: number; c: number }[] {
  const k = key.trim();
  if (!k) return [];
  if (k.includes(":")) {
    const [a, b] = k.split(":", 2);
    const start = parseExcelCellRef(a);
    const end = parseExcelCellRef(b);
    if (!start || !end) return [];
    const out: { r: number; c: number }[] = [];
    for (let r = start.r; r <= end.r; r++) {
      for (let c = start.c; c <= end.c; c++) {
        out.push({ r, c });
      }
    }
    return out;
  }
  const one = parseExcelCellRef(k);
  return one ? [one] : [];
}

/**
 * Excel “list” validation → FortuneSheet `dropdown` + `value1` range or comma list.
 * Cross-sheet refs (e.g. `AllActsPatch!$A$1:$L$1`) are passed through for `getcellrange` / `getDropdownList`.
 */
function normalizeExcelListFormula(formula: string): string {
  let s = String(formula).trim();
  if (s.startsWith("=")) s = s.slice(1);
  if (
    !s.includes("!") &&
    ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1).replace(/""/g, '"');
  }
  return s;
}

function excelDataValidationsToFortune(
  ws: ExcelJS.Worksheet,
): Record<string, FortuneDataVerificationItem> | undefined {
  /* ExcelJS exposes `dataValidations` at runtime when reading .xlsx; typings omit it on Worksheet. */
  const model = (
    ws as ExcelJS.Worksheet & {
      dataValidations?: { model?: Record<string, ExcelJS.DataValidation> };
    }
  ).dataValidations?.model;
  if (!model || typeof model !== "object") return undefined;

  const out: Record<string, FortuneDataVerificationItem> = {};

  for (const [rangeKey, rule] of Object.entries(model)) {
    if (!rule || rule.type !== "list") continue;
    const raw = rule.formulae?.[0];
    if (raw == null || String(raw).trim() === "") continue;

    const value1 = normalizeExcelListFormula(String(raw));
    if (!value1) continue;

    const item: FortuneDataVerificationItem = {
      type: "dropdown",
      type2: "",
      value1,
      value2: "",
      validity: "",
      remote: false,
      prohibitInput: false,
      hintShow: Boolean(rule.showInputMessage && rule.prompt),
      hintValue: rule.prompt != null ? String(rule.prompt) : "",
    };

    for (const { r, c } of expandExcelRangeKey(rangeKey)) {
      out[`${r}_${c}`] = item;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

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
    const dataVerification = excelDataValidationsToFortune(ws);
    sheets.push({
      id: randomUUID(),
      name: ws.name || `Sheet${order + 1}`,
      status: order === 0 ? 1 : 0,
      row: nRows,
      column: nCols,
      data,
      ...(dataVerification ? { dataVerification } : {}),
      order: order++,
    });
  });
  if (sheets.length === 0) {
    throw new Error("Workbook has no sheets");
  }
  return sheets;
}
