#!/usr/bin/env node
/**
 * Build DH Pick & Patch v7 JSON — single-sheet workbook from the human-made Excel.
 *
 * Keeps only "Channel List" (patch input in A–J), adds same-sheet summary (M–N)
 * and a compact SatBox label grid (M–R) with INDEX/MATCH lookups — no cross-sheet
 * formulas, no helper columns.
 *
 * Usage:
 *   node scripts/build-v7-template.mjs > examples/DH_Pick_Patch_TEMPLATE_v7.json
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/* Polyfill — the Excel library references window.navigator */
if (typeof globalThis.window === "undefined") {
  globalThis.window = { navigator: { userAgent: "Node" }, devicePixelRatio: 1 };
}

const { transformExcelToFortune } = await import("@zenmrp/fortune-sheet-excel");

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = resolve(
  __dirname,
  "../examples/DH Pick & Patch TEMPLATE v7.0 - human made.xlsx",
);

const MAIN_COLS = 10; // A–J (0–9)
const OUT_COLS = 18; // A–R (0–17)
const MAIN_ROWS = 101; // rows 1–101 (0–100): header + 100 channel rows
const MIN_ROWS = 36;
const MIN_COLS = 18;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function toDenseMatrix(celldata, rows, cols) {
  const m = Array.from({ length: rows }, () => new Array(cols).fill(null));
  for (const c of celldata) {
    if (c.r < rows && c.c < cols && c.v != null) m[c.r][c.c] = c.v;
  }
  return m;
}

function buildCalcChain(data, sheetId) {
  const chain = [];
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c]?.f) chain.push({ r, c, id: sheetId, index: sheetId });
    }
  }
  return chain;
}

function sanitizeMatrix(data) {
  for (const row of data) {
    for (const cell of row) {
      if (cell == null) continue;
      if (typeof cell.tb === "number") cell.tb = String(cell.tb);
    }
  }
}

function filterMerge(merge, maxRow, maxCol) {
  if (!merge || typeof merge !== "object") return undefined;
  const out = {};
  for (const [key, m] of Object.entries(merge)) {
    if (!m || typeof m.r !== "number" || typeof m.c !== "number") continue;
    const rs = m.rs ?? 1;
    const cs = m.cs ?? 1;
    if (m.r >= maxRow || m.c >= maxCol) continue;
    if (m.r + rs > maxRow || m.c + cs > maxCol) continue;
    out[key] = m;
  }
  return Object.keys(out).length ? out : undefined;
}

function filterColumnLen(columnlen, maxCol) {
  if (!columnlen || typeof columnlen !== "object") return undefined;
  const out = {};
  for (const [k, v] of Object.entries(columnlen)) {
    const i = parseInt(k, 10);
    if (!Number.isNaN(i) && i < maxCol) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function filterRowlen(rowlen, maxRow) {
  if (!rowlen || typeof rowlen !== "object") return undefined;
  const out = {};
  for (const [k, v] of Object.entries(rowlen)) {
    const i = parseInt(k, 10);
    if (!Number.isNaN(i) && i < maxRow) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function cellText(v, bold = false) {
  return {
    v,
    m: String(v),
    ct: { fa: "General", t: "g" },
    ...(bold ? { bl: 1 } : {}),
  };
}

function cellFormula(f, v = 0, m = "0") {
  return {
    f,
    v,
    m,
    ct: { fa: "General", t: "n" },
  };
}

function cellFormulaText(f, v = "", m = "") {
  return {
    f,
    v,
    m: m || String(v),
    ct: { fa: "General", t: "s" },
  };
}

/* ------------------------------------------------------------------ */
/*  1. Parse Excel                                                    */
/* ------------------------------------------------------------------ */

const buf = readFileSync(EXCEL_PATH);
const saved = console.log;
console.log = () => {};
const result = await transformExcelToFortune(buf);
console.log = saved;

const rawSheets = result.sheets;
const rawCl = rawSheets[0];
if (!rawCl) throw new Error("Excel has no sheets");

const name =
  rawCl.name?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ??
  "Channel List";
if (!name.includes("Channel")) {
  console.warn("warn: first sheet is not Channel List:", name);
}

const cd = rawCl.celldata || [];
let maxR = 0,
  maxC = 0;
for (const c of cd) {
  if (c.r > maxR) maxR = c.r;
  if (c.c > maxC) maxC = c.c;
}
const srcRows = Math.max(rawCl.row || maxR + 1, MIN_ROWS);
const srcCols = Math.max(rawCl.column || maxC + 1, MIN_COLS);
const srcData = rawCl.data ?? toDenseMatrix(cd, srcRows, srcCols);
sanitizeMatrix(srcData);

/* ------------------------------------------------------------------ */
/*  2. Build single sheet: A–J from Excel, clear old stand block      */
/* ------------------------------------------------------------------ */

const rows = Math.max(MAIN_ROWS, MIN_ROWS);
const data = Array.from({ length: rows }, () =>
  Array.from({ length: OUT_COLS }, () => null),
);

for (let r = 0; r < rows; r++) {
  const srcRow = srcData[r];
  if (!srcRow) continue;
  for (let c = 0; c < MAIN_COLS; c++) {
    const cell = srcRow[c];
    if (cell != null) data[r][c] = cell;
  }
}

/* Remove legacy "Additional Stands" / Tall / Short / Round rows (Excel rows 98–101) */
for (let r = 97; r <= 100 && r < rows; r++) {
  for (let c = 0; c < MAIN_COLS; c++) {
    data[r][c] = null;
  }
}

const cfg = rawCl.config ?? {};
const config = {};
if (cfg.borderInfo?.length) {
  config.borderInfo = cfg.borderInfo.filter(
    (b) => b.row_index < rows && b.col_index < OUT_COLS,
  );
}
const fm = filterMerge(cfg.merge, rows, OUT_COLS);
if (fm) config.merge = fm;
const cr = filterColumnLen(cfg.columnlen, OUT_COLS);
if (cr) config.columnlen = cr;
const rr = filterRowlen(cfg.rowlen, rows);
if (rr) config.rowlen = rr;
if (cfg.rowhidden) config.rowhidden = cfg.rowhidden;
/* Excel hid helper columns in AA–AD and sometimes M–N; do not carry colhidden —
 * hiding M–R breaks the summary / SatBox grid, and keys ≥ OUT_COLS confuse the grid. */
if (cfg.customHeight) config.customHeight = cfg.customHeight;
if (cfg.customWidth) config.customWidth = cfg.customWidth;

const sheetId = String(rawCl.id ?? "1");

/* ------------------------------------------------------------------ */
/*  3. Summary M1:N6 (0-based row 0–5, col 12–13)                     */
/* ------------------------------------------------------------------ */

data[0][12] = cellText("Summary", true);
data[0][13] = cellText("Count", true);

data[1][12] = cellText("Tall Stands");
data[1][13] = cellFormula('=COUNTIF($G$2:$G$101,"Tall*")');

data[2][12] = cellText("Short Stands");
data[2][13] = cellFormula('=COUNTIF($G$2:$G$101,"Short*")');

data[3][12] = cellText("Round Bases");
data[3][13] = cellFormula('=COUNTIF($G$2:$G$101,"Round*")');

data[4][12] = cellText("Total Channels");
data[4][13] = cellFormula("=COUNTA($D$2:$D$101)");

data[5][12] = cellText("Total Mics");
data[5][13] = cellFormula("=COUNTA($E$2:$E$101)");

/* ------------------------------------------------------------------ */
/*  4. SatBox label grid — row 8 = index 7                            */
/* ------------------------------------------------------------------ */

const subHdr = (text, bg) => ({
  v: text,
  m: text,
  ct: { fa: "General", t: "g" },
  bg,
  bl: 1,
});

// Row 8 (index 7): group titles + "Lable" subheaders (match legacy spelling)
const rHdr = 7;
data[rHdr][12] = subHdr("Red (1)", "#FFC7CE");
data[rHdr][13] = subHdr("Lable", "#F4B4C4");
data[rHdr][14] = subHdr("Green (2)", "#C6EFCE");
data[rHdr][15] = subHdr("Lable", "#A8E0B8");
data[rHdr][16] = subHdr("Blue (3)", "#BDD6EE");
data[rHdr][17] = subHdr("Lable", "#9EC5E8");

const prefixes = [
  ["R", "G", "B"],
  ["Y", "O", "P"],
];
/** First data row index for each block: R1 at 8 (row 9), Y1 at 22 (row 23) */
const blockDataStart = [8, 22];

function fillSatboxBlock(blockIdx) {
  const [p0, p1, p2] = prefixes[blockIdx];
  const startIdx = blockDataStart[blockIdx];
  for (let i = 0; i < 12; i++) {
    const r = startIdx + i;
    if (r >= rows) break;
    const id0 = `${p0}${i + 1}`;
    const id1 = `${p1}${i + 1}`;
    const id2 = `${p2}${i + 1}`;
    const row1 = r + 1;

    /* VLOOKUP col 3 = Item (D) within B:D — FortuneSheet handles this more reliably than INDEX/MATCH+IFERROR */
    data[r][12] = cellText(id0);
    data[r][13] = cellFormulaText(
      `=IFERROR(VLOOKUP(M${row1},$B$2:$D$101,3,0),"")`,
      "",
      "",
    );

    data[r][14] = cellText(id1);
    data[r][15] = cellFormulaText(
      `=IFERROR(VLOOKUP(O${row1},$B$2:$D$101,3,0),"")`,
      "",
      "",
    );

    data[r][16] = cellText(id2);
    data[r][17] = cellFormulaText(
      `=IFERROR(VLOOKUP(Q${row1},$B$2:$D$101,3,0),"")`,
      "",
      "",
    );
  }
}

fillSatboxBlock(0);

// Row 21 (index 20): blank separator in M–R — do not overwrite A–J
// Second block header row 22 (index 21)
const rHdr2 = 21;
data[rHdr2][12] = subHdr("Yellow (4)", "#FFEB9C");
data[rHdr2][13] = subHdr("Lable", "#FFE066");
data[rHdr2][14] = subHdr("Orange (5)", "#F7CAAC");
data[rHdr2][15] = subHdr("Lable", "#F0B080");
data[rHdr2][16] = subHdr("Purple (6)", "#F4D3FD");
data[rHdr2][17] = subHdr("Lable", "#E8B8F0");

fillSatboxBlock(1);

/* ------------------------------------------------------------------ */
/*  5. Conditional formatting — SatBox# B–C                          */
/* ------------------------------------------------------------------ */

const satboxColors = [
  { letter: "P", bg: "#F4D3FD", fc: "#441E61" },
  { letter: "O", bg: "#F7CAAC", fc: "#843C0B" },
  { letter: "Y", bg: "#FFEB9C", fc: "#9C5700" },
  { letter: "B", bg: "#BDD6EE", fc: "#002060" },
  { letter: "R", bg: "#FFC7CE", fc: "#9C0006" },
  { letter: "G", bg: "#C6EFCE", fc: "#006100" },
];

const channelListCF = satboxColors.flatMap(({ letter, bg, fc }) => [
  {
    type: "default",
    cellrange: [
      { row: [1, 97], column: [1, 2] },
      { row: [98, 100], column: [2, 2] },
    ],
    format: { textColor: fc, cellColor: bg },
    conditionName: "textContains",
    conditionRange: [],
    conditionValue: [letter],
  },
  {
    type: "default",
    cellrange: [
      { row: [1, 97], column: [1, 2] },
      { row: [98, 100], column: [2, 2] },
    ],
    format: { textColor: fc, cellColor: bg },
    conditionName: "textContains",
    conditionRange: [],
    conditionValue: [letter.toLowerCase()],
  },
]);

/* Grey-out empty label cells (N, P, R) for the two SatBox blocks */
const labelEmptyCF = [
  {
    type: "default",
    cellrange: [
      { row: [8, 19], column: [13, 13] },
      { row: [8, 19], column: [15, 15] },
      { row: [8, 19], column: [17, 17] },
      { row: [22, 33], column: [13, 13] },
      { row: [22, 33], column: [15, 15] },
      { row: [22, 33], column: [17, 17] },
    ],
    format: { textColor: "#BFBFBF", cellColor: null },
    conditionName: "equal",
    conditionRange: [],
    conditionValue: [""],
  },
];

const sheet = {
  id: sheetId,
  name: "Channel List",
  status: 1,
  order: 0,
  row: rows,
  column: OUT_COLS,
  data,
  config,
  calcChain: buildCalcChain(data, sheetId),
  luckysheet_conditionformat_save: [...channelListCF, ...labelEmptyCF],
  ...(typeof rawCl.defaultColWidth === "number"
    ? { defaultColWidth: rawCl.defaultColWidth }
    : {}),
  ...(typeof rawCl.defaultRowHeight === "number"
    ? { defaultRowHeight: rawCl.defaultRowHeight }
    : {}),
};

/* ------------------------------------------------------------------ */
/*  6. Envelope                                                       */
/* ------------------------------------------------------------------ */

const envelope = {
  changeoverlordWorkbook: 1,
  exportedAt: new Date().toISOString(),
  kind: "patchTemplate",
  label: "DH Pick & Patch TEMPLATE v7.0 (single sheet)",
  sheets: [sheet],
};

process.stdout.write(JSON.stringify(envelope));
