#!/usr/bin/env node
/**
 * Generates the DH Pick & Patch template as FortuneSheet JSON.
 * Run: node scripts/build-dh-template.mjs > examples/DH_Pick_Patch_TEMPLATE_v6.json
 */

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  headerBg:   "#244A6B",
  headerFc:   "#FFFFFF",
  bodyFc:     "#243447",
  rowOdd:     "#FBFDFF",
  rowEven:    "#F4F9FE",
  emptyBg:    "#F3F6F9",
  red:        "#F4CDD4",
  blue:       "#DCEAF7",
  green:      "#E8F2EA",
  yellow:     "#FFFFC3",
  orange:     "#F1E0D1",
  purple:     "#EFE3F7",
  titleBg:    "#17324D",
  standBg:    "#2F7F87",
  standCellBg:"#DFF1F3",
  standValBg: "#F7FCFD",
  subtitleBg: "#F5F7FA",
  subtitleFc: "#5F6B7A",
  micListBg:  "#E8F4EF",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function emptyRow(cols) { return Array.from({ length: cols }, () => null); }
function emptyMatrix(rows, cols) { return Array.from({ length: rows }, () => emptyRow(cols)); }

function cell(v, opts = {}) {
  const c = { ct: { fa: "General", t: "g" }, ...opts };
  if (v !== undefined && v !== null) {
    c.v = v;
    c.m = String(v);
  }
  return c;
}

function headerCell(v, extraOpts = {}) {
  return cell(v, { bg: C.headerBg, fc: C.headerFc, bl: 1, fs: 10, ht: 0, vt: 1, tb: "2", ...extraOpts });
}

function bodyCell(v, row, extraOpts = {}) {
  const bg = row % 2 === 0 ? C.rowOdd : C.rowEven;
  return cell(v, { bg, fc: C.bodyFc, fs: 10, ht: 1, vt: 1, tb: "2", ...extraOpts });
}

function formulaCell(f, opts = {}) {
  return { f, ct: { fa: "General", t: "g" }, ...opts };
}

// ─── Sheet 1: Channel List ──────────────────────────────────────────────────
function buildChannelList() {
  const ROWS = 104, COLS = 31;
  const data = emptyMatrix(ROWS, COLS);
  const calcChain = [];
  const id = "sheet_1";

  // Row 0: Header row
  const headers = ["Stage Box Input", "SatBox#", "Desk Ch#", "Item", "Mic/DI", "Stand", "Position", "Notes"];
  headers.forEach((h, c) => { data[0][c] = headerCell(h, { ht: 0 }); });
  // Extend header bg across cols 8-9 (I, J columns that exist in original)
  for (let c = 8; c <= 9; c++) data[0][c] = headerCell("", { ht: 0 });

  // SB1 rows: 1-48 (SB1 in01 through SB1 in48)
  for (let i = 0; i < 48; i++) {
    const r = i + 1;
    const num = String(i + 1).padStart(2, "0");
    const label = `SB1 in${num}`;
    data[r][0] = bodyCell(label, r);                           // A: Stage Box Input
    data[r][1] = bodyCell(undefined, r, { bg: C.emptyBg });    // B: SatBox# (user fills)
    data[r][2] = bodyCell(r, r, { ht: 0, bg: C.emptyBg });    // C: Desk Ch#
    for (let c = 3; c <= 7; c++) data[r][c] = bodyCell(undefined, r); // D-H: empty editable
  }

  // SB2 rows: 49-92 (SB2 in1 through SB2 in44)
  for (let i = 0; i < 44; i++) {
    const r = 49 + i;
    const label = `SB2 in${i + 1}`;
    data[r][0] = bodyCell(label, r);
    data[r][1] = bodyCell(undefined, r, { bg: C.emptyBg });
    data[r][2] = bodyCell(r, r, { ht: 0, bg: C.emptyBg });
    for (let c = 3; c <= 7; c++) data[r][c] = bodyCell(undefined, r);
  }

  // Empty rows 93-103
  for (let r = 93; r < ROWS; r++) {
    for (let c = 0; c <= 7; c++) data[r][c] = bodyCell(undefined, r);
  }

  // Helper formula columns (rows 4-103, i.e. rows 5-104 in Excel notation)
  for (let r = 4; r <= 103; r++) {
    const excelRow = r + 1;
    const prevRow = r;

    // AA (col 26): echo Mic/DI if present
    const fAA = `=IF(E${excelRow}="","",E${excelRow})`;
    data[r][26] = formulaCell(fAA);
    calcChain.push({ r, c: 26, id, index: id });

    // AD (col 29): sequential numbering of non-empty mic entries
    const fAD = `=IF(E${excelRow}="","",MAX($AD$3:$AD${prevRow})+1)`;
    data[r][29] = formulaCell(fAD);
    calcChain.push({ r, c: 29, id, index: id });

    // AE (col 30): stand type detection from Position column
    const fAE = `=IF(G${excelRow}="","",IF(ISNUMBER(SEARCH("tall",LOWER(G${excelRow}&""))),"tall",IF(ISNUMBER(SEARCH("short",LOWER(G${excelRow}&""))),"short",IF(ISNUMBER(SEARCH("round",LOWER(G${excelRow}&""))),"round",""))))`;
    data[r][30] = formulaCell(fAE);
    calcChain.push({ r, c: 30, id, index: id });
  }

  // Row heights: 0=40, 1=27, 2=52, 3=35, rest=27
  const rowlen = { 0: 40, 2: 52, 3: 35 };
  for (let r = 1; r < ROWS; r++) if (!rowlen[r]) rowlen[r] = 27;

  return {
    id,
    name: "Channel List",
    status: 1,
    order: 0,
    row: ROWS,
    column: COLS,
    data,
    calcChain,
    config: {
      merge: {
        "0_0": { r: 0, c: 0, rs: 1, cs: 10 },
      },
      columnlen: { 0: 117, 1: 89, 2: 75, 3: 215, 4: 131, 5: 19, 6: 103, 7: 19, 8: 89, 9: 201, 10: 19, 11: 19, 12: 19, 13: 19, 14: 96, 15: 96, 16: 96, 17: 96 },
      rowlen,
      colhidden: { 5: 0, 7: 0, 10: 0, 11: 0, 12: 0, 13: 0 },
      customHeight: {},
      customWidth: {},
    },
  };
}

// ─── Sheet 2: Mic & DI List ─────────────────────────────────────────────────
function buildMicDIList() {
  const ROWS = 40, COLS = 5;
  const data = emptyMatrix(ROWS, COLS);
  const calcChain = [];
  const id = "sheet_2";

  // Row 0: Title + Stand Count header
  data[0][0] = formulaCell(`='Channel List'!A1&" - Mic Pick List"`, {
    bg: C.titleBg, fc: C.headerFc, bl: 1, fs: 18, ht: 1, vt: 1, tb: "2",
    mc: { r: 0, c: 0, rs: 1, cs: 3 },
  });
  data[0][1] = { mc: { r: 0, c: 0 } };
  data[0][2] = { mc: { r: 0, c: 0 } };
  data[0][3] = cell("Stand Count", {
    bg: C.standBg, fc: C.headerFc, bl: 1, fs: 16, ht: 0, vt: 1, tb: "2",
    mc: { r: 0, c: 3, rs: 1, cs: 2 },
  });
  data[0][4] = { mc: { r: 0, c: 3 } };
  calcChain.push({ r: 0, c: 0, id, index: id });

  // Row 1: Subtitle + Tall Stands
  data[1][0] = cell("(AUTO Filled from Channel list)", { bg: C.subtitleBg, fc: C.subtitleFc, fs: 10, ht: 1, vt: 1, tb: "2" });
  data[1][1] = cell("Full Mic List", { bg: C.micListBg, fc: C.bodyFc, bl: 1, fs: 10, ht: 0, vt: 1, tb: "2" });
  data[1][3] = cell("Tall Stands", { bg: C.standCellBg, fc: C.bodyFc, bl: 1, fs: 10, ht: 1, vt: 1, tb: "2" });
  data[1][4] = formulaCell(`=COUNTIF('Channel List'!$AE$5:$AE$104,"tall")`, {
    bg: C.standValBg, fc: C.titleBg, bl: 1, fs: 12, ht: 0, vt: 1, tb: "2",
  });
  calcChain.push({ r: 1, c: 4, id, index: id });

  // Row 2: Column headers + Short Stands
  data[2][0] = headerCell("Mic");
  data[2][1] = headerCell("Quantity");
  data[2][3] = cell("Short Stands", { bg: C.standCellBg, fc: C.bodyFc, bl: 1, fs: 10, ht: 1, vt: 1, tb: "2" });
  data[2][4] = formulaCell(`=COUNTIF('Channel List'!$AE$5:$AE$104,"short")`, {
    bg: C.standValBg, fc: C.titleBg, bl: 1, fs: 12, ht: 0, vt: 1, tb: "2",
  });
  calcChain.push({ r: 2, c: 4, id, index: id });

  // Row 3: Round Bases count
  data[3][3] = cell("Round Bases", { bg: C.standCellBg, fc: C.bodyFc, bl: 1, fs: 10, ht: 1, vt: 1, tb: "2" });
  data[3][4] = formulaCell(`=COUNTIF('Channel List'!$AE$5:$AE$104,"round")`, {
    bg: C.standValBg, fc: C.titleBg, bl: 1, fs: 12, ht: 0, vt: 1, tb: "2",
  });
  calcChain.push({ r: 3, c: 4, id, index: id });

  // Rows 3-39: Auto-filled mic list
  for (let r = 3; r < ROWS; r++) {
    const excelRow = r - 2; // ROW(A1) starts at 1 for row index 3
    const bg = r % 2 === 0 ? "#F7FAFC" : "#FFFFFF";

    data[r][0] = formulaCell(
      `=IF(COUNTIF('Channel List'!$AD$5:$AD$104,ROW(A${excelRow}))=0,"",INDEX('Channel List'!$AA$5:$AA$104,MATCH(ROW(A${excelRow}),'Channel List'!$AD$5:$AD$104,0)))`,
      { bg, fc: C.bodyFc, fs: 10, ht: 1, vt: 1, tb: "2" },
    );
    calcChain.push({ r, c: 0, id, index: id });

    data[r][1] = formulaCell(
      `=IF(A${r + 1}="","",COUNTIF('Channel List'!$AA$5:$AA$104,A${r + 1}))`,
      { bg, fc: C.bodyFc, fs: 10, ht: 0, vt: 1, tb: "2" },
    );
    calcChain.push({ r, c: 1, id, index: id });
  }

  const rowlen = { 0: 45, 1: 29, 2: 29, 39: 29 };
  for (let r = 3; r < ROWS - 1; r++) rowlen[r] = 25;

  return {
    id,
    name: "Mic & DI List",
    status: 0,
    order: 1,
    row: ROWS,
    column: COLS,
    data,
    calcChain,
    config: {
      merge: {
        "0_0": { r: 0, c: 0, rs: 1, cs: 3 },
        "0_3": { r: 0, c: 3, rs: 1, cs: 2 },
      },
      columnlen: { 0: 215, 1: 89, 2: 19, 3: 131, 4: 75 },
      rowlen,
      customHeight: {},
      customWidth: {},
    },
  };
}

// ─── Sheet 3: SatBox Labels ─────────────────────────────────────────────────
function buildSatBoxLabels() {
  const ROWS = 43, COLS = 5;
  const data = emptyMatrix(ROWS, COLS);
  const calcChain = [];
  const id = "sheet_3";

  const colorGroups = [
    // Left column (A/B): Red, Blue, Orange
    { col: "A", prefix: "R",  label: "Red (1)",    bg: C.red,    startRow: 0  },
    { col: "A", prefix: "B",  label: "Blue (3)",   bg: C.blue,   startRow: 15 },
    { col: "A", prefix: "O",  label: "Orange (5)", bg: C.orange, startRow: 30 },
    // Right column (D/E): Green, Yellow, Purple
    { col: "D", prefix: "G",  label: "Green (2)",  bg: C.green,  startRow: 0  },
    { col: "D", prefix: "Y",  label: "Yellow (4)", bg: C.yellow, startRow: 15 },
    { col: "D", prefix: "P",  label: "Purple (6)", bg: C.purple, startRow: 30 },
  ];

  for (const group of colorGroups) {
    const isLeft = group.col === "A";
    const nameCol = isLeft ? 0 : 3;
    const formulaCol = isLeft ? 1 : 4;
    const r0 = group.startRow;

    // Header row
    data[r0][nameCol] = cell(group.label, {
      bg: group.bg, fc: C.titleBg, bl: 1, fs: 10, ht: 0, vt: 1, tb: "2",
    });
    data[r0][formulaCol] = cell("Label", {
      bg: group.bg, fc: C.titleBg, bl: 1, fs: 10, ht: 0, vt: 1, tb: "2",
    });

    // 12 label rows
    for (let i = 1; i <= 12; i++) {
      const r = r0 + i;
      const excelRow = r + 1;
      const labelVal = `${group.prefix}${i}`;
      const altBg = i % 2 === 0 ? "#F6F8FA" : "#FFFFFF";

      data[r][nameCol] = cell(labelVal, {
        bg: group.bg, fc: C.bodyFc, fs: 10, ht: 2, vt: 1, tb: "2",
      });

      const refCol = isLeft ? "A" : "D";
      data[r][formulaCol] = formulaCell(
        `=IFERROR(VLOOKUP(TRIM(${refCol}${excelRow}),'Channel List'!$B$1:$D$100,3,0),"")`,
        { bg: altBg, fc: C.bodyFc, fs: 10, ht: 1, vt: 1, tb: "2" },
      );
      calcChain.push({ r, c: formulaCol, id, index: id });
    }
  }

  const rowlen = {};
  for (let r = 0; r < ROWS; r++) {
    if (r === 0 || r === 15 || r === 30) rowlen[r] = 32;
    else if (r === 12 || r === 14 || r === 27 || r === 29 || r === 42) rowlen[r] = 21;
    else rowlen[r] = 20;
  }

  return {
    id,
    name: "SatBox Lables",
    status: 0,
    order: 2,
    row: ROWS,
    column: COLS,
    data,
    calcChain,
    config: {
      merge: {},
      columnlen: { 0: 117, 1: 159, 2: 33, 3: 117, 4: 159 },
      rowlen,
      customHeight: {},
      customWidth: {},
    },
  };
}

// ─── Sheet 4: Equipment Pick List ───────────────────────────────────────────
function buildEquipmentPickList() {
  const ROWS = 36, COLS = 5;
  const data = emptyMatrix(ROWS, COLS);
  const calcChain = [];
  const id = "sheet_4";

  // Row 0: Title
  data[0][0] = formulaCell(`='Channel List'!A1&" - Equipment Pick List"`, {
    bg: C.titleBg, fc: C.headerFc, bl: 1, fs: 22, ht: 1, vt: 1, tb: "2",
    mc: { r: 0, c: 0, rs: 1, cs: 5 },
  });
  for (let c = 1; c <= 4; c++) data[0][c] = { mc: { r: 0, c: 0 } };
  calcChain.push({ r: 0, c: 0, id, index: id });

  // Row 1: Instructions
  data[1][0] = cell("Use this sheet as the final pack checklist and add quantities manually as needed", {
    bg: C.subtitleBg, fc: C.subtitleFc, fs: 10, ht: 1, vt: 1, tb: "2",
    mc: { r: 1, c: 0, rs: 1, cs: 5 },
  });
  for (let c = 1; c <= 4; c++) data[1][c] = { mc: { r: 1, c: 0 } };

  // Row 2: Headers
  const eqHeaders = ["Type", "Item", "Quantity", "Pack Where?", "Notes"];
  eqHeaders.forEach((h, c) => { data[2][c] = headerCell(h); });

  // Rows 3+: empty data rows with alternating bg
  for (let r = 3; r < ROWS; r++) {
    const bg = r % 2 === 0 ? "#F8FBFD" : "#FFFFFF";
    for (let c = 0; c < COLS; c++) {
      data[r][c] = cell(undefined, { bg, fc: C.bodyFc, fs: 10, ht: c === 2 ? 0 : 1, vt: 1, tb: "2" });
    }
  }

  const rowlen = { 0: 40, 1: 27, 2: 29 };
  for (let r = 3; r < 20; r++) rowlen[r] = 24;

  return {
    id,
    name: "Equipment Pick List",
    status: 0,
    order: 3,
    row: ROWS,
    column: COLS,
    data,
    calcChain,
    config: {
      merge: {
        "0_0": { r: 0, c: 0, rs: 1, cs: 5 },
        "1_0": { r: 1, c: 0, rs: 1, cs: 5 },
      },
      columnlen: { 0: 117, 1: 215, 2: 89, 3: 173, 4: 96 },
      rowlen,
      customHeight: {},
      customWidth: {},
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
const template = {
  changeoverlordWorkbook: 1,
  kind: "patchTemplate",
  label: "DH Pick & Patch TEMPLATE v6",
  sheets: [
    buildChannelList(),
    buildMicDIList(),
    buildSatBoxLabels(),
    buildEquipmentPickList(),
  ],
};

process.stdout.write(JSON.stringify(template));
