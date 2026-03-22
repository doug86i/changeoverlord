/**
 * Decode a persisted Yjs `opLog` snapshot into `Sheet[]` by applying each op
 * as a direct JSON mutation.
 *
 * The opLog is a Yjs Array of JSON-stringified `Op[]` batches. Batch 0 is
 * typically `[{op:"replace", path:["luckysheetfile"], value: Sheet[]}]` — the
 * initial upload. Subsequent batches are cell edits, config changes, row/col
 * deletions, etc., each scoped to a sheet by `op.id`.
 *
 * Previous implementation tried to route ops through FortuneSheet's
 * `opToPatch` + Immer `applyPatches`. That never worked because
 * `applyPatches` returns a new object and the return value was discarded.
 */
import * as Y from "yjs";
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
        if (s.id) sheetById.set(s.id, s);
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
      const v = op.value as { type: string; start: number; end: number; id?: string; direction?: string };
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
      if (newSheet.id) sheetById.set(newSheet.id, newSheet);
      continue;
    }

    if (op.op === "deleteSheet" && op.value) {
      const delId = (op.value as { id: string }).id;
      const idx = sheets.findIndex((s) => s.id === delId);
      if (idx >= 0) sheets.splice(idx, 1);
      sheetById.delete(delId);
      continue;
    }

    // Regular replace / add: apply value at path on the target sheet.
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
function ensureCalcChain(sheet: Sheet): void {
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

/**
 * Replay a frozen list of `opLog` JSON strings (same order as in Yjs).
 * Used for compaction and by {@link replayYjsSnapshotToSheets}.
 */
export function replayOpLogStringEntries(entries: readonly string[]): Sheet[] {
  const sheets: Sheet[] = [];
  const sheetById = new Map<string, Sheet>();

  for (const raw of entries) {
    if (typeof raw !== "string") continue;
    let ops: Op[];
    try {
      ops = JSON.parse(raw) as Op[];
    } catch {
      continue;
    }
    if (!Array.isArray(ops)) continue;
    applyOpBatch(sheets, sheetById, ops);
  }

  for (const sheet of sheets) ensureCalcChain(sheet);
  return sheets;
}

/**
 * True if replay output is safe to persist as a single `replace luckysheetfile` op.
 * Rejects empty arrays, sheets without ids, and sheets with neither `data` nor `celldata`
 * (headless replay can diverge from FortuneSheet and would otherwise compact to a blank grid).
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

/** Decode a persisted Yjs update (template or performance snapshot) to `Sheet[]`. */
export function replayYjsSnapshotToSheets(snapshot: Uint8Array): Sheet[] {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  const opLog = doc.getArray<string>("opLog");
  if (opLog.length === 0) return [];
  return replayOpLogStringEntries(opLog.toArray());
}
