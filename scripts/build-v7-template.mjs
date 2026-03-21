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
/*  5.  Conditional formatting rules                                  */
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

const channelListCF = satboxColors.map(({ letter, bg, fc }) => ({
  type: "default",
  cellrange: [
    { row: [1, 97], column: [1, 2] },
    { row: [98, 100], column: [2, 2] },
  ],
  format: { textColor: fc, cellColor: bg },
  conditionName: "textContains",
  conditionRange: [],
  conditionValue: [letter],
}));

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
const clSheet = normalised.find((s) => s.name === "Channel List");
if (clSheet) clSheet.luckysheet_conditionformat_save = channelListCF;

const sbSheet = normalised.find((s) => s.name === "SatBox Lables");
if (sbSheet) sbSheet.luckysheet_conditionformat_save = satboxLabelsCF;

/* ------------------------------------------------------------------ */
/*  6.  Emit changeoverlordWorkbook envelope                          */
/* ------------------------------------------------------------------ */

const envelope = {
  changeoverlordWorkbook: 1,
  exportedAt: new Date().toISOString(),
  kind: "patchTemplate",
  label: "DH Pick & Patch TEMPLATE v7.0",
  sheets: normalised,
};

process.stdout.write(JSON.stringify(envelope));
