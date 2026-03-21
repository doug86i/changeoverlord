import * as Y from "yjs";
import type { Op, Sheet } from "@fortune-sheet/core";

/**
 * Encode a FortuneSheet workbook as a Yjs update matching the web client’s
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

/** Decode a stored template snapshot back to `Sheet[]` (for preview / tooling). */
export function decodeTemplateSnapshotToSheets(buf: Buffer): Sheet[] {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(buf));
  const opLog = doc.getArray<string>("opLog");
  let last: Sheet[] | null = null;
  for (let i = 0; i < opLog.length; i++) {
    const raw = opLog.get(i);
    try {
      const ops = JSON.parse(raw) as Op[];
      for (const op of ops) {
        if (
          op.op === "replace" &&
          op.path?.[0] === "luckysheetfile" &&
          Array.isArray(op.value)
        ) {
          last = op.value as Sheet[];
        }
      }
    } catch {
      /* continue */
    }
  }
  return last ?? [];
}
