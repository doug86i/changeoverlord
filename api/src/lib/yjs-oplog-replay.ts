/**
 * Replays persisted Yjs `opLog` batches through FortuneSheet's op → Immer patch
 * pipeline so server-side export matches the live collaborative workbook.
 *
 * `decodeTemplateSnapshotToSheets` used to only read the last full
 * `replace luckysheetfile` batch; edits are granular patches, so exports were stale.
 */
import { applyPatches, enablePatches } from "immer";
import type { Patch } from "immer";
import * as Y from "yjs";
import type { Context, Op, Sheet } from "@fortune-sheet/core";
import {
  addSheet,
  api,
  createFilterOptions,
  defaultContext,
  defaultSettings,
  deleteRowCol,
  deleteSheet,
  getSheetIndex,
  insertRowCol,
  opToPatch,
} from "@fortune-sheet/core";

enablePatches();

function nullRef<T>(): { current: T | null } {
  return { current: null };
}

function createHeadlessRefs(): Parameters<typeof defaultContext>[0] {
  return {
    globalCache: { undoList: [], redoList: [] },
    cellInput: nullRef<HTMLDivElement>(),
    fxInput: nullRef<HTMLDivElement>(),
    canvas: nullRef<HTMLCanvasElement>(),
    cellArea: nullRef<HTMLDivElement>(),
    workbookContainer: nullRef<HTMLDivElement>(),
  };
}

/** Mirrors `@fortune-sheet/react` Workbook `applyOp` (headless). */
function applyOpBatch(
  ctx: Context,
  ops: Op[],
  settings: typeof defaultSettings,
): void {
  const [patchList, specialOps] = opToPatch(ctx, ops);
  const patches = patchList as Patch[];

  if (specialOps.length > 0) {
    const specialOp = specialOps[0] as {
      op: string;
      value: { id?: string } & Record<string, unknown>;
    };
    if (specialOp.op === "insertRowCol") {
      try {
        insertRowCol(ctx, specialOp.value as never, false);
      } catch {
        /* same as Workbook: swallow */
      }
    } else if (specialOp.op === "deleteRowCol") {
      deleteRowCol(ctx, specialOp.value as never);
    } else if (specialOp.op === "addSheet") {
      const namePatch = patches.find((p) => p.path[0] === "name");
      const name =
        namePatch && "value" in namePatch
          ? (namePatch.value as string | undefined)
          : undefined;
      const sid = specialOp.value?.id;
      if (sid) {
        addSheet(ctx, settings, sid, false, name, specialOp.value as Sheet);
        const fileIndex = getSheetIndex(ctx, sid);
        if (fileIndex != null) {
          api.initSheetData(ctx, fileIndex, specialOp.value as Sheet);
        }
      }
    } else if (specialOp.op === "deleteSheet") {
      deleteSheet(ctx, (specialOp.value as { id: string }).id);
      patches.length = 0;
    }
  }

  const op0 = ops[0];
  const p0 = op0?.path?.[0];
  if (p0 === "filter_select") {
    ctx.luckysheet_filter_save = op0.value as never;
  } else if (p0 === "hide" && op0.id && ctx.currentSheetId === op0.id) {
    const hiddenId = op0.id;
    const shownSheets = ctx.luckysheetfile.filter(
      (sheet) =>
        (sheet.hide === undefined || sheet.hide !== 1) && sheet.id !== hiddenId,
    );
    shownSheets.sort(
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
    );
    const first = shownSheets[0];
    if (first?.id) ctx.currentSheetId = first.id;
  }

  createFilterOptions(ctx, ctx.luckysheet_filter_save, op0?.id);

  if (patches.length === 0) return;
  try {
    applyPatches(ctx, patches);
  } catch {
    /* match Workbook: log-free in API */
  }
}

/** Decode a persisted Yjs update (template or performance snapshot) to `Sheet[]`. */
export function replayYjsSnapshotToSheets(snapshot: Uint8Array): Sheet[] {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  const opLog = doc.getArray<string>("opLog");
  const n = opLog.length;
  if (n === 0) return [];

  const ctx = defaultContext(createHeadlessRefs());
  const settings = structuredClone(defaultSettings);

  for (let i = 0; i < n; i++) {
    const raw = opLog.get(i);
    if (typeof raw !== "string") continue;
    let ops: Op[];
    try {
      ops = JSON.parse(raw) as Op[];
    } catch {
      continue;
    }
    if (!Array.isArray(ops)) continue;
    applyOpBatch(ctx, ops, settings);
  }

  return api.getAllSheets(ctx) ?? [];
}
