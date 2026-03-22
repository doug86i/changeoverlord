#!/usr/bin/env node
/**
 * Build DH Pick & Patch v7 JSON from the human-made Excel.
 *
 * Reads the .xlsx via @zenmrp/fortune-sheet-excel (cells, formulas, styles,
 * borders, merges, column widths), then adds conditional formatting rules
 * that the library cannot extract from OOXML.
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

/* ------------------------------------------------------------------ */
/*  1.  Parse Excel → raw FortuneSheet sheets                        */
/* ------------------------------------------------------------------ */

const buf = readFileSync(EXCEL_PATH);
const saved = console.log;
console.log = () => {}; // suppress library debug output
const result = await transformExcelToFortune(buf);
console.log = saved;

const sheets = result.sheets;

/* ------------------------------------------------------------------ */
/*  2.  Helpers                                                       */
/* ------------------------------------------------------------------ */

/** Sparse celldata → dense data matrix. */
function toDenseMatrix(celldata, rows, cols) {
  const m = Array.from({ length: rows }, () => new Array(cols).fill(null));
  for (const c of celldata) {
    if (c.r < rows && c.c < cols && c.v != null) m[c.r][c.c] = c.v;
  }
  return m;
}

/** Build calcChain by scanning data matrix for formula cells. */
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

/** Coerce cell.tb to string (FortuneSheet runtime expects string literals). */
function sanitizeMatrix(data) {
  for (const row of data) {
    for (const cell of row) {
      if (cell == null) continue;
      if (typeof cell.tb === "number") cell.tb = String(cell.tb);
      const mc = cell.mc;
      if (mc && (mc.rs != null || mc.cs != null) && mc.r == null) {
        // find the actual position — already set by the library usually
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  3.  Normalise each sheet                                          */
/* ------------------------------------------------------------------ */

const MIN_ROWS = 36;
const MIN_COLS = 18;

const normalised = sheets.map((raw, idx) => {
  const cd = raw.celldata || [];
  let maxR = 0,
    maxC = 0;
  for (const c of cd) {
    if (c.r > maxR) maxR = c.r;
    if (c.c > maxC) maxC = c.c;
  }
  const rows = Math.max(raw.row || maxR + 1, MIN_ROWS);
  const cols = Math.max(raw.column || maxC + 1, MIN_COLS);

  const data = raw.data ?? toDenseMatrix(cd, rows, cols);
  sanitizeMatrix(data);

  const cfg = raw.config ?? {};
  const config = {};
  if (cfg.merge) config.merge = cfg.merge;
  if (cfg.borderInfo?.length) config.borderInfo = cfg.borderInfo;
  if (cfg.rowlen) config.rowlen = cfg.rowlen;
  if (cfg.columnlen) config.columnlen = cfg.columnlen;
  if (cfg.rowhidden) config.rowhidden = cfg.rowhidden;
  if (cfg.colhidden) config.colhidden = cfg.colhidden;
  if (cfg.customHeight) config.customHeight = cfg.customHeight;
  if (cfg.customWidth) config.customWidth = cfg.customWidth;

  const sheetId = String(raw.id ?? idx + 1);
  const name =
    raw.name?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ??
    `Sheet${idx + 1}`;

  return {
    id: sheetId,
    name,
    status: idx === 0 ? 1 : 0,
    order: idx,
    row: rows,
    column: cols,
    data,
    config,
    calcChain: buildCalcChain(data, sheetId),
    ...(typeof raw.defaultColWidth === "number"
      ? { defaultColWidth: raw.defaultColWidth }
      : {}),
    ...(typeof raw.defaultRowHeight === "number"
      ? { defaultRowHeight: raw.defaultRowHeight }
      : {}),
  };
});

/* ------------------------------------------------------------------ */
/*  4.  Fix #REF! formula in Equipment Pick List (sheet 4, cell A1)   */
/* ------------------------------------------------------------------ */

const equipSheet = normalised.find((s) => s.name === "Equipment Pick List");
if (equipSheet && equipSheet.data[0]?.[0]) {
  const cell = equipSheet.data[0][0];
  if (cell.f && cell.f.includes("#REF!")) {
    cell.f = '="Equipment Pick List"';
    cell.v = "Equipment Pick List";
    cell.m = "Equipment Pick List";
    if (cell.ct) cell.ct = { fa: "General", t: "s" };
  }
}

/* ------------------------------------------------------------------ */
/*  5.  Make helper columns case-insensitive with UPPER()             */
/* ------------------------------------------------------------------ */

const clSheet = normalised.find((s) => s.name === "Channel List");

/*
 * Helper columns AA-AD on Channel List wrap values with UPPER() so
 * cross-sheet lookups (Mic & DI List, SatBox Labels) match regardless
 * of whether the user types "R1" or "r1" in SatBox#.
 *
 * AA (col 26): =IF(E2="","",UPPER(E2))   — Mic/DI (was plain E2)
 * AB (col 27): =IF(G2="","",UPPER(G2))   — Stand  (was plain G2)
 * AC (col 28): =IF(D2="","",UPPER(D2))   — Item   (was plain D2)
 * AD (col 29): unchanged — running unique index
 */
if (clSheet) {
  for (let r = 1; r <= 100; r++) {
    const row = clSheet.data[r];
    if (!row) continue;
    // Col 26 (AA): wrap with UPPER
    if (row[26]?.f) {
      const origCol = String.fromCharCode(69); // E
      const ref = `${origCol}${r + 1}`;
      row[26].f = `=IF(${ref}="","",UPPER(${ref}))`;
    }
    // Col 27 (AB): wrap with UPPER
    if (row[27]?.f) {
      const origCol = String.fromCharCode(71); // G
      const ref = `${origCol}${r + 1}`;
      row[27].f = `=IF(${ref}="","",UPPER(${ref}))`;
    }
    // Col 28 (AC): wrap with UPPER
    if (row[28]?.f) {
      const origCol = String.fromCharCode(68); // D
      const ref = `${origCol}${r + 1}`;
      row[28].f = `=IF(${ref}="","",UPPER(${ref}))`;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  5b. Add stand count summary to Channel List (same-sheet = live)   */
/* ------------------------------------------------------------------ */

/*
 * Cross-sheet formulas don't update in real time in FortuneSheet.
 * Moving stand count summaries to Channel List (same sheet as the data)
 * ensures they update immediately when the user edits.
 *
 * Place summary in rows 103-106 (after the existing data in rows 1-101).
 */
if (clSheet) {
  const sumStartRow = 102; // 0-indexed (= row 103 in spreadsheet)
  const summaryData = [
    // Row 103: header
    { c: 0, v: "Summary", bold: true },
    { c: 1, v: "Count", bold: true },
    // Row 104: Tall stands
    { r: 1, c: 0, v: "Tall Stands", formula: null },
    { r: 1, c: 1, v: null, formula: '=COUNTIF($G$2:$G$101,"Tall*")+$C$99' },
    // Row 105: Short stands
    { r: 2, c: 0, v: "Short Stands", formula: null },
    { r: 2, c: 1, v: null, formula: '=COUNTIF($G$2:$G$101,"Short*")+$C$100' },
    // Row 106: Round bases
    { r: 3, c: 0, v: "Round Bases", formula: null },
    { r: 3, c: 1, v: null, formula: '=COUNTIF($G$2:$G$101,"Round*")+$C$101' },
  ];

  // Ensure data array is large enough
  while (clSheet.data.length <= sumStartRow + 4) {
    clSheet.data.push(new Array(clSheet.column).fill(null));
  }
  clSheet.row = Math.max(clSheet.row, sumStartRow + 5);

  for (const entry of summaryData) {
    const r = sumStartRow + (entry.r ?? 0);
    const c = entry.c;
    if (!clSheet.data[r]) clSheet.data[r] = new Array(clSheet.column).fill(null);
    if (entry.formula) {
      clSheet.data[r][c] = {
        f: entry.formula,
        v: 0,
        m: "0",
        ct: { fa: "General", t: "n" },
      };
    } else if (entry.v != null) {
      clSheet.data[r][c] = {
        v: entry.v,
        m: String(entry.v),
        ct: { fa: "General", t: "g" },
        ...(entry.bold ? { bl: 1 } : {}),
      };
    }
  }

  // Rebuild calcChain to include the new formula cells
  clSheet.calcChain = buildCalcChain(clSheet.data, clSheet.id);
}

/* ------------------------------------------------------------------ */
/*  6.  Conditional formatting rules                                  */
/* ------------------------------------------------------------------ */

/*
 * Channel List (sheet 1) — SatBox prefix colour coding
 *
 * Excel has beginsWith rules on B2:C98 and C99:C101.
 * FortuneSheet supports textContains (substring match on cell.v).
 * Since SatBox# values are like "R1", "G2", "B3" etc., textContains
 * with a single letter matches the same cells.
 *
 * Colours from dxf entries (ARGB → RGB):
 *   P  Purple   bg=#F4D3FD  fc=#441E61
 *   O  Orange   bg=#F7CAAC  fc=#843C0B   (theme5 + tint 0.6)
 *   Y  Yellow   bg=#FFEB9C  fc=#9C5700
 *   B  Blue     bg=#BDD6EE  fc=#002060   (theme8 + tint 0.6)
 *   R  Red      bg=#FFC7CE  fc=#9C0006
 *   G  Green    bg=#C6EFCE  fc=#006100
 */

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

/*
 * Channel List — Notes column (L = col 11) green highlight when non-empty.
 *
 * FortuneSheet doesn't have a "not blank" condition. Approximate it with
 * textContains matching any character — but that would need a regex,
 * which FortuneSheet doesn't support.
 *
 * Skip this rule — it's a minor visual hint. The green formatting is
 * already baked into the cell styles where the Excel had static values.
 */

/*
 * SatBox Lables (sheet 3) — cells equal to 0 → grey text
 * Hides formula results that evaluate to 0 (empty lookup).
 */

const satboxLabelsCF = [
  {
    type: "default",
    cellrange: [
      { row: [3, 15], column: [0, 5] },
      { row: [16, 17], column: [0, 7] },
      { row: [18, 30], column: [0, 4] },
      { row: [33, 45], column: [0, 4] },
    ],
    format: { textColor: "#BFBFBF", cellColor: null },
    conditionName: "equal",
    conditionRange: [],
    conditionValue: ["0"],
  },
];

/* Attach CF to the correct sheets. */
if (clSheet) clSheet.luckysheet_conditionformat_save = channelListCF;

const sbSheet = normalised.find((s) => s.name === "SatBox Lables");
if (sbSheet) sbSheet.luckysheet_conditionformat_save = satboxLabelsCF;

/* ------------------------------------------------------------------ */
/*  7.  Emit changeoverlordWorkbook envelope                          */
/* ------------------------------------------------------------------ */

const envelope = {
  changeoverlordWorkbook: 1,
  exportedAt: new Date().toISOString(),
  kind: "patchTemplate",
  label: "DH Pick & Patch TEMPLATE v7.0",
  sheets: normalised,
};

process.stdout.write(JSON.stringify(envelope));
