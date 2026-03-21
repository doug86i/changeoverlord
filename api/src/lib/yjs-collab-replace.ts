import * as Y from "yjs";
import { docs } from "@y/websocket-server/utils";
import type { Op, Sheet } from "@fortune-sheet/core";
import { encodeTemplateSnapshotFromSheets } from "./yjs-template-snapshot.js";

export function performanceCollabDocName(performanceId: string): string {
  return `ws/v1/collab/${performanceId}`;
}

export function templateCollabDocName(templateId: string): string {
  return `ws/v1/collab-template/${templateId}`;
}

/**
 * If a Yjs collab room is loaded, replace its `opLog` with a single `luckysheetfile`
 * replace batch so connected clients sync. Returns whether an in-memory doc existed.
 */
export function replaceCollabOpLogWithSheets(
  docName: string,
  sheets: Sheet[],
): boolean {
  const doc = docs.get(docName);
  if (!doc) return false;
  const opLog = doc.getArray<string>("opLog");
  const ops: Op[] = [
    { op: "replace", path: ["luckysheetfile"], value: sheets },
  ];
  doc.transact(() => {
    const n = opLog.length;
    if (n > 0) {
      opLog.delete(0, n);
    }
    opLog.push([JSON.stringify(ops)]);
  });
  return true;
}

/** Binary snapshot to persist after a workbook JSON import (live room or cold). */
export function workbookSnapshotBufferForPersist(
  docName: string,
  sheets: Sheet[],
): Buffer {
  if (replaceCollabOpLogWithSheets(docName, sheets)) {
    const doc = docs.get(docName);
    if (doc) {
      return Buffer.from(Y.encodeStateAsUpdate(doc));
    }
  }
  return encodeTemplateSnapshotFromSheets(sheets);
}
