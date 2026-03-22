/**
 * Apply FortuneSheet `Op[]` batches to `Sheet[]` via direct JSON mutation (server-side mirror of
 * `applyOp` semantics). Used by the collab relay and persistence paths.
 */
import type { Op, Sheet } from "@fortune-sheet/core";

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
        start: number;
        end: number;
        id?: string;
        direction?: string;
      };
      const sh = sheetById.get(v.id ?? (op as { id?: string }).id ?? "");
      if (!sh?.data) continue;
      const count = v.end - v.start + 1;
      if (v.type === "row") {
        const cols = sh.data[0]?.length ?? 0;
        const empties = Array.from({ length: count }, () =>
          Array.from({ length: cols }, () => null),
        );
        sh.data.splice(v.start, 0, ...empties);
      } else if (v.type === "column") {
        for (const row of sh.data) {
          if (Array.isArray(row)) {
            row.splice(v.start, 0, ...Array.from({ length: count }, () => null));
          }
        }
      }
      continue;
    }

    if (op.op === "addSheet" && op.value) {
      const newSheet = op.value as Sheet;
      sheets.push(newSheet);
      if (newSheet.id) sheetById.set(String(newSheet.id), newSheet);
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
 * True if workbook JSON is safe to serve / persist.
 * Rejects empty arrays, sheets without ids, and sheets with neither `data` nor `celldata`.
 */
export function sheetsLookUsableAfterOpLogReplay(sheets: Sheet[]): boolean {
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

/** Parse `sheets_json` from Postgres into `Sheet[]` (deep clone for safe mutation). */
export function sheetsFromJsonb(value: unknown): Sheet[] {
  if (!Array.isArray(value)) return [];
  return structuredClone(value) as Sheet[];
}
