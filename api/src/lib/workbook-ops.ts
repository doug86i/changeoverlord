/**
 * Apply FortuneSheet `Op[]` batches to `Sheet[]` via direct JSON mutation (server-side mirror of
 * `applyOp` semantics). Used by the collab relay and persistence paths.
 */
import type { Op, Sheet } from "@fortune-sheet/core";

/** Matches `createDefaultPatchWorkbookSheets` when `row` / `column` are missing. */
const MATERIALIZE_ROWS_FALLBACK = 36;
const MATERIALIZE_COLS_FALLBACK = 18;

/**
 * Fortune `addSheet` often creates tabs with `row` / `column` but **no** `data` or `celldata` until
 * the client runs `initSheetData`. Relay persist allows that shape (`sheetsSafeForCollabPersist`);
 * materialize so `sheetsUsableForServing` / export / ops that need `data` behave.
 */
export function ensureSheetDataMatrixFromRowCol(sheet: Sheet): void {
  const data = sheet.data;
  const hasMatrix = Array.isArray(data) && data.length > 0;
  const cd = (sheet as { celldata?: unknown[] }).celldata;
  const hasCelldata = Array.isArray(cd) && cd.length > 0;
  if (hasMatrix || hasCelldata) return;
  const rowNum = (sheet as { row?: unknown }).row;
  const colNum = (sheet as { column?: unknown }).column;
  const rows =
    typeof rowNum === "number" && Number.isFinite(rowNum) && rowNum > 0
      ? Math.floor(rowNum)
      : MATERIALIZE_ROWS_FALLBACK;
  const cols =
    typeof colNum === "number" && Number.isFinite(colNum) && colNum > 0
      ? Math.floor(colNum)
      : MATERIALIZE_COLS_FALLBACK;
  sheet.data = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

export function materializeEmptySheetMatrices(sheets: Sheet[]): void {
  for (const s of sheets) {
    if (s && typeof s === "object") ensureSheetDataMatrixFromRowCol(s);
  }
}

/** After reading `sheets_json` for a WebSocket room: fill blank tab matrices + calc chains. */
export function hydrateSheetsForCollabRoom(sheets: Sheet[]): void {
  materializeEmptySheetMatrices(sheets);
  for (const s of sheets) ensureCalcChain(s);
}

function setAtPath(obj: Record<string, unknown>, path: (string | number)[], value: unknown): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const next = cur[k as string];
    if (next === undefined || next === null) {
      cur[k as string] = typeof path[i + 1] === "number" ? [] : {};
    }
    cur = cur[k as string] as Record<string, unknown>;
  }
  cur[path[path.length - 1] as string] = value;
}

function applyOpBatch(
  sheets: Sheet[],
  sheetById: Map<string, Sheet>,
  ops: Op[],
): void {
  for (const op of ops) {
    if (op.op === "replace" && op.path?.[0] === "luckysheetfile" && Array.isArray(op.value)) {
      sheets.length = 0;
      sheetById.clear();
      for (const s of op.value as Sheet[]) {
        sheets.push(s);
        if (s.id) sheetById.set(String(s.id), s);
        ensureSheetDataMatrixFromRowCol(s);
      }
      continue;
    }

    if (op.op === "deleteRowCol" && op.value) {
      const v = op.value as { type: string; start: number; end: number; id?: string };
      const sh = sheetById.get(v.id ?? (op as { id?: string }).id ?? "");
      if (!sh?.data) continue;
      const count = v.end - v.start + 1;
      if (v.type === "row") {
        sh.data.splice(v.start, count);
      } else if (v.type === "column") {
        for (const row of sh.data) {
          if (Array.isArray(row)) row.splice(v.start, count);
        }
      }
      continue;
    }

    if (op.op === "insertRowCol" && op.value) {
      const v = op.value as {
        type: string;
        /** FortuneSheet / op.md — primary shape */
        index?: number;
        count?: number;
        direction?: string;
        id?: string;
        /** Legacy mistaken mirror (ignored when index/count present) */
        start?: number;
        end?: number;
      };
      const sh = sheetById.get(v.id ?? (op as { id?: string }).id ?? "");
      if (!sh?.data || sh.data.length === 0) continue;

      let index: number;
      let count: number;
      if (v.index !== undefined && v.count !== undefined) {
        index = Math.max(0, Math.floor(Number(v.index)) || 0);
        count = Math.max(0, Math.floor(Number(v.count)) || 0);
      } else if (v.start !== undefined && v.end !== undefined) {
        index = Math.max(0, Math.floor(Number(v.start)) || 0);
        count = Math.max(0, Math.floor(Number(v.end)) - Math.floor(Number(v.start)) + 1);
      } else {
        continue;
      }
      if (count === 0) continue;

      const direction = v.direction === "lefttop" ? "lefttop" : "rightbottom";

      if (v.type === "row") {
        const cols = sh.data[0]?.length ?? 0;
        const empties = Array.from({ length: count }, () =>
          Array.from({ length: cols }, () => null),
        );
        if (direction === "lefttop") {
          if (index === 0) {
            sh.data.unshift(...empties);
          } else {
            sh.data.splice(index, 0, ...empties);
          }
        } else {
          sh.data.splice(index + 1, 0, ...empties);
        }
      } else if (v.type === "column") {
        const nullCols = () => Array.from({ length: count }, () => null);
        for (const row of sh.data) {
          if (!Array.isArray(row)) continue;
          if (direction === "lefttop") {
            if (index === 0) {
              row.unshift(...nullCols());
            } else {
              row.splice(index, 0, ...nullCols());
            }
          } else {
            row.splice(index + 1, 0, ...nullCols());
          }
        }
      }
      continue;
    }

    if (op.op === "addSheet" && op.value) {
      const newSheet = op.value as Sheet;
      const sid =
        newSheet.id != null && String(newSheet.id).trim() !== ""
          ? String(newSheet.id)
          : "";
      // Idempotent: duplicate addSheet batches (double onOp / replay) must not append twice.
      if (sid && sheetById.has(sid)) continue;
      sheets.push(newSheet);
      if (sid) sheetById.set(sid, newSheet);
      ensureSheetDataMatrixFromRowCol(newSheet);
      continue;
    }

    if (op.op === "deleteSheet" && op.value) {
      const delId = (op.value as { id: string }).id;
      const idx = sheets.findIndex((s) => s.id === delId);
      if (idx >= 0) sheets.splice(idx, 1);
      sheetById.delete(delId);
      continue;
    }

    const sheetId = (op as { id?: string }).id;
    if (!sheetId) continue;
    const sh = sheetById.get(sheetId);
    if (!sh) continue;
    const path = op.path;
    if (!path || path.length === 0) continue;
    setAtPath(sh as unknown as Record<string, unknown>, path, op.value);
  }
}

/**
 * Ensure every formula cell is represented in `calcChain`.
 * Without this, FortuneSheet's incremental recalc ignores the formula.
 */
export function ensureCalcChain(sheet: Sheet): void {
  const id = sheet.id ?? "";
  const existing = Array.isArray(sheet.calcChain) ? sheet.calcChain : [];
  const seen = new Set<string>();
  for (const e of existing) seen.add(`${e.r},${e.c}`);

  const chain = [...existing];
  const data = sheet.data;
  if (!data) {
    sheet.calcChain = chain;
    return;
  }
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c]?.f && !seen.has(`${r},${c}`)) {
        chain.push({ r, c, id, index: id });
      }
    }
  }
  sheet.calcChain = chain;
}

/** Apply one `Op[]` batch in place; rebuilds id map from `sheets` first. */
export function applyOpBatchToSheets(sheets: Sheet[], ops: Op[]): void {
  const sheetById = new Map<string, Sheet>();
  for (const s of sheets) {
    if (s.id != null && String(s.id).trim() !== "") sheetById.set(String(s.id), s);
  }
  applyOpBatch(sheets, sheetById, ops);
  for (const sheet of sheets) ensureCalcChain(sheet);
}

/**
 * True if workbook JSON is safe to **serve** (export, sheets-export 404 gate) or to **seed** a new
 * room from DB (strict grid signal). Rejects empty arrays, sheets without ids, and sheets with
 * neither non-empty `data` nor non-empty `celldata`.
 */
export function sheetsUsableForServing(sheets: Sheet[]): boolean {
  if (!Array.isArray(sheets) || sheets.length === 0) return false;
  for (const s of sheets) {
    if (!s || typeof s !== "object") return false;
    if (s.id == null || String(s.id).trim() === "") return false;
    const data = s.data;
    const hasMatrix = Array.isArray(data) && data.length > 0;
    const cd = (s as { celldata?: unknown[] }).celldata;
    const hasCelldata = Array.isArray(cd) && cd.length > 0;
    if (!hasMatrix && !hasCelldata) return false;
  }
  return true;
}

/**
 * Minimum bar for writing `sheets_json` from the collab relay. Stricter than nothing (ids +
 * non-empty tab list) but unlike {@link sheetsUsableForServing} allows sheets whose
 * `data`/`celldata` are empty so operators can persist cleared grids without losing the workbook.
 */
export function sheetsSafeForCollabPersist(sheets: Sheet[]): boolean {
  if (!Array.isArray(sheets) || sheets.length === 0) return false;
  for (const s of sheets) {
    if (!s || typeof s !== "object") return false;
    if (s.id == null || String(s.id).trim() === "") return false;
  }
  return true;
}

/** Parse `sheets_json` from Postgres into `Sheet[]` (deep clone for safe mutation). */
export function sheetsFromJsonb(value: unknown): Sheet[] {
  if (!Array.isArray(value)) return [];
  return structuredClone(value) as Sheet[];
}
