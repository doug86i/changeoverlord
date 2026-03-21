import * as Y from "yjs";
import type { Op, Sheet } from "@fortune-sheet/core";
import { replayYjsSnapshotToSheets } from "./yjs-oplog-replay.js";

/**
 * Encode a FortuneSheet workbook as a Yjs update matching the web client's
 * `opLog` + `applyOp` flow (`PatchPage`).
 */
export function encodeTemplateSnapshotFromSheets(sheets: Sheet[]): Buffer {
  const doc = new Y.Doc();
  const opLog = doc.getArray<string>("opLog");
  const ops: Op[] = [
    { op: "replace", path: ["luckysheetfile"], value: sheets },
  ];
  doc.transact(() => {
    opLog.push([JSON.stringify(ops)]);
  });
  return Buffer.from(Y.encodeStateAsUpdate(doc));
}

/**
 * Decode a stored Yjs workbook snapshot to `Sheet[]` (export, preview, clone).
 * Walks the full `opLog` and applies each op as a direct JSON mutation.
 */
export function decodeTemplateSnapshotToSheets(buf: Buffer): Sheet[] {
  return replayYjsSnapshotToSheets(new Uint8Array(buf));
}
