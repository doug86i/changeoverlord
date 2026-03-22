#!/usr/bin/env node
/**
 * Operator Patch Reference v1 — generated entirely in Node (no Excel, no v7 script reuse).
 *
 * Design goals (FortuneSheet + formulajs + Yjs):
 * 1. Single sheet — no cross-sheet recalc ordering.
 * 2. Stand summaries use COUNTIF only with LITERAL criteria (no "*" wildcards — formulajs treats * as text).
 * 3. Hidden normalizer column: LOWER(TRIM(stand)) so operators can type "Tall" / "tall"; counts match "tall".
 * 4. SatBox print labels: IFERROR(VLOOKUP(...,0),"") only; table is $B$2:$D$last (Item in column D = index 3).
 * 5. Dense data[] + calcChain[] with one entry per formula cell (same shape as api excel-to-sheets buildCalcChain).
 *
 * Usage:
 *   node scripts/generate-operator-patch-v1.mjs > examples/OPERATOR_PATCH_REFERENCE_v1.json
 */

const SHEET_ID = "operator-patch-v1";
const NAME = "Operator patch v1";
/** Header row + 50 channel rows (adjust LAST_DATA_ROW if you need more). */
const HEADER_ROW = 0;
const FIRST_DATA_ROW = 1;
const LAST_DATA_ROW = 50;
const ROWS = LAST_DATA_ROW + 1;
const COLS = 18;

/** Column indices (0 = A). */
const COL = {
  satboxInput: 0,
  satboxKey: 1,
  desk: 2,
  item: 3,
  mic: 4,
  standRaw: 5,
  standNorm: 6,
  notes: 7,
  // K–M used for a small label preview grid (row indices set below)
};

const LABEL_GRID = {
  startRow: 20,
  codes: ["G1", "G2", "G3", "R1", "R2", "B1", "B2", "Y1"],
  codeCol: 10, // K
  labelCol: 11, // L
};

function emptyMatrix(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

function textCell(value, style = {}) {
  return {
    v: value,
    m: value,
    ct: { fa: "General", t: "s" },
    ...style,
  };
}

function headerCell(value) {
  return textCell(value, {
    bg: "#1f4e79",
    fc: "#ffffff",
    bl: 1,
    fs: 10,
    ht: 1,
    vt: 0,
    tb: "2",
  });
}

function formulaCell(f) {
  return {
    f,
    ct: { fa: "General", t: "n" },
  };
}

function buildCalcChain(data, sheetId) {
  const chain = [];
  const seen = new Set();
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c]?.f) {
        const k = `${r},${c}`;
        if (seen.has(k)) continue;
        seen.add(k);
        chain.push({ r, c, id: sheetId, index: sheetId });
      }
    }
  }
  return chain;
}

function main() {
  const data = emptyMatrix(ROWS, COLS);

  // —— Header row
  data[HEADER_ROW][COL.satboxInput] = headerCell("Stage box");
  data[HEADER_ROW][COL.satboxKey] = headerCell("SatBox key");
  data[HEADER_ROW][COL.desk] = headerCell("Desk #");
  data[HEADER_ROW][COL.item] = headerCell("Item");
  data[HEADER_ROW][COL.mic] = headerCell("Mic/DI");
  data[HEADER_ROW][COL.standRaw] = headerCell("Stand (any case)");
  data[HEADER_ROW][COL.standNorm] = headerCell("Norm (auto)");
  data[HEADER_ROW][COL.notes] = headerCell("Notes");

  // —— Data rows: normalizer links to stand column (same row)
  const last = LAST_DATA_ROW;
  for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
    const excelRow = r + 1;
    const fLetter = "F";
    data[r][COL.standNorm] = formulaCell(
      `=IF(${fLetter}${excelRow}="","",LOWER(TRIM(${fLetter}${excelRow})))`,
    );
  }

  // —— Summary block (rows 1–6, columns O–P = 14–15) — keep away from data table
  const summaryCol = 14; // O
  const valueCol = 15; // P
  const rangeG = `$G$${FIRST_DATA_ROW + 1}:$G$${last + 1}`;

  const summaries = [
    ["Stand: tall", `=COUNTIF(${rangeG},"tall")`],
    ["Stand: short", `=COUNTIF(${rangeG},"short")`],
    ["Stand: round", `=COUNTIF(${rangeG},"round")`],
    ["Channels (Item)", `=COUNTA($D$${FIRST_DATA_ROW + 1}:$D$${last + 1})`],
    ["Mics filled", `=COUNTA($E$${FIRST_DATA_ROW + 1}:$E$${last + 1})`],
    ["SatBox keys", `=COUNTA($B$${FIRST_DATA_ROW + 1}:$B$${last + 1})`],
  ];

  for (let i = 0; i < summaries.length; i++) {
    const r = HEADER_ROW + 1 + i;
    data[r][summaryCol] = textCell(summaries[i][0], { bl: 1 });
    data[r][valueCol] = formulaCell(summaries[i][1]);
  }

  data[HEADER_ROW][summaryCol] = headerCell("Summary");
  data[HEADER_ROW][valueCol] = headerCell("Value");

  // —— Label preview: static code in K, VLOOKUP Item (col D = 3) in L
  const tableRange = `$B$${FIRST_DATA_ROW + 1}:$D$${last + 1}`;
  const gr = LABEL_GRID.startRow;
  data[gr - 1][LABEL_GRID.codeCol] = headerCell("Slot");
  data[gr - 1][LABEL_GRID.labelCol] = headerCell("Item (lookup)");

  LABEL_GRID.codes.forEach((code, i) => {
    const r = gr + i;
    const excelRow = r + 1;
    const kCol = String.fromCharCode(65 + LABEL_GRID.codeCol); // K
    data[r][LABEL_GRID.codeCol] = textCell(code);
    data[r][LABEL_GRID.labelCol] = formulaCell(
      `=IFERROR(VLOOKUP(${kCol}${excelRow},${tableRange},3,0),"")`,
    );
  });

  const noteRow = gr + LABEL_GRID.codes.length + 1;
  data[noteRow][LABEL_GRID.codeCol] = textCell(
    "Type stands as tall/short/round (any case). Add SatBox keys in B to match slots.",
    { tb: "2" },
  );

  const calcChain = buildCalcChain(data, SHEET_ID);

  const sheet = {
    id: SHEET_ID,
    name: NAME,
    status: 1,
    order: 0,
    row: ROWS,
    column: COLS,
    data,
    calcChain,
  };

  const out = {
    changeoverlordWorkbook: 1,
    exportedAt: new Date().toISOString(),
    kind: "patchTemplate",
    label: "Operator patch reference v1 (FortuneSheet-safe)",
    sheets: [sheet],
  };

  process.stdout.write(`${JSON.stringify(out)}\n`);
}

main();
