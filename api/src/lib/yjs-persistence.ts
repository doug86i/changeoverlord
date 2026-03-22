import * as Y from "yjs";
import { eq } from "drizzle-orm";
import type { WSSharedDoc } from "@y/websocket-server/utils";
import { docs } from "@y/websocket-server/utils";
import type { Op, Sheet } from "@fortune-sheet/core";
import { db } from "../db/client.js";
import { patchTemplates, performanceYjsSnapshots } from "../db/schema.js";
import { broadcastInvalidate } from "./realtime-bus.js";
import { createLogger } from "./log.js";
import { replayYjsSnapshotToSheets } from "./yjs-oplog-replay.js";

const ylog = createLogger("yjs-persist");

const debounceMs = 1000;
const docTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * OpLog entries beyond this threshold trigger compaction on persist.
 * Compaction replaces the full history with a single `replace luckysheetfile`
 * op built from the replayed current state, preventing unbounded growth.
 */
const OPLOG_COMPACT_THRESHOLD = 200;

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDocName(
  docname: string,
):
  | { kind: "performance"; id: string }
  | { kind: "template"; id: string }
  | null {
  if (docname.startsWith("ws/v1/collab-template/")) {
    const id = docname.slice("ws/v1/collab-template/".length);
    return uuidRe.test(id) ? { kind: "template", id } : null;
  }
  if (docname.startsWith("ws/v1/collab/")) {
    const id = docname.slice("ws/v1/collab/".length);
    return uuidRe.test(id) ? { kind: "performance", id } : null;
  }
  return null;
}

/**
 * If the opLog has grown past the compaction threshold, replay all ops
 * into the current sheet state and replace the opLog with a single
 * `replace luckysheetfile` entry. This keeps the persisted snapshot
 * small and page-load replay fast.
 */
function maybeCompactOpLog(doc: WSSharedDoc): void {
  const opLog = doc.getArray<string>("opLog");
  if (opLog.length <= OPLOG_COMPACT_THRESHOLD) return;

  const snap = Y.encodeStateAsUpdate(doc);
  let sheets: Sheet[];
  try {
    sheets = replayYjsSnapshotToSheets(new Uint8Array(snap));
  } catch (err) {
    ylog.warn({ err, docname: doc.name, opLogLen: opLog.length }, "opLog compaction replay failed; skipping");
    return;
  }
  if (sheets.length === 0) return;

  const beforeLen = opLog.length;
  const ops: Op[] = [
    { op: "replace", path: ["luckysheetfile"], value: sheets },
  ];
  doc.transact(() => {
    opLog.delete(0, opLog.length);
    opLog.push([JSON.stringify(ops)]);
  });
  ylog.info({ docname: doc.name, before: beforeLen, after: 1 }, "opLog compacted");
}

async function persistSnapshot(
  docname: string,
  doc: WSSharedDoc,
): Promise<void> {
  const target = parseDocName(docname);
  if (!target) return;

  maybeCompactOpLog(doc);

  const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc));
  ylog.debug({ docname, bytes: snapshot.length }, "persisting snapshot");

  if (target.kind === "performance") {
    await db
      .insert(performanceYjsSnapshots)
      .values({
        performanceId: target.id,
        snapshot,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: performanceYjsSnapshots.performanceId,
        set: { snapshot, updatedAt: new Date() },
      });
    return;
  }

  await db
    .update(patchTemplates)
    .set({ snapshot, updatedAt: new Date() })
    .where(eq(patchTemplates.id, target.id));

  broadcastInvalidate([["patchTemplates"], ["patchTemplate"], ["events"]]);
}

function schedulePersist(docname: string, doc: WSSharedDoc): void {
  const prev = docTimers.get(docname);
  if (prev) clearTimeout(prev);
  docTimers.set(
    docname,
    setTimeout(() => {
      docTimers.delete(docname);
      void persistSnapshot(docname, doc).catch((err) => {
        ylog.error({ err, docname }, "persist debounced snapshot failed");
      });
    }, debounceMs),
  );
}

/**
 * Flush all pending debounce timers and persist every active Yjs doc.
 * Called on SIGTERM / SIGINT so container restarts don't lose edits.
 */
export async function flushAllYjsDocs(): Promise<void> {
  for (const [docname, timer] of docTimers) {
    clearTimeout(timer);
    docTimers.delete(docname);
  }

  const entries = Array.from(docs.entries());
  if (entries.length === 0) return;

  ylog.info({ count: entries.length }, "flushing all Yjs docs before shutdown");
  const results = await Promise.allSettled(
    entries.map(([docname, doc]) =>
      persistSnapshot(docname, doc as WSSharedDoc),
    ),
  );
  let ok = 0;
  let fail = 0;
  for (const r of results) {
    if (r.status === "fulfilled") ok++;
    else {
      fail++;
      ylog.error({ err: r.reason }, "shutdown flush failed for doc");
    }
  }
  ylog.info({ ok, fail }, "shutdown flush complete");
}

export function createYjsPersistence() {
  return {
    bindState(docname: string, doc: WSSharedDoc): void {
      const target = parseDocName(docname);
      if (!target) return;

      /**
       * IMPORTANT: register `update` → schedulePersist **only after** the DB snapshot
       * is applied. Otherwise a debounced persist can run while the doc is still empty
       * (WebSocket sync step 1 already ran) and **overwrite Postgres** with a partial
       * state — common when DB latency is higher (e.g. prod / remote disk).
       */
      void (async () => {
        try {
          if (target.kind === "performance") {
            const [row] = await db
              .select({ snapshot: performanceYjsSnapshots.snapshot })
              .from(performanceYjsSnapshots)
              .where(eq(performanceYjsSnapshots.performanceId, target.id))
              .limit(1);
            if (row?.snapshot?.length) {
              Y.applyUpdate(doc, new Uint8Array(row.snapshot));
              ylog.debug(
                { performanceId: target.id, bytes: row.snapshot.length },
                "loaded snapshot from db",
              );
            } else {
              ylog.debug({ performanceId: target.id }, "no snapshot in db; empty doc");
            }
            return;
          }

          const [row] = await db
            .select({ snapshot: patchTemplates.snapshot })
            .from(patchTemplates)
            .where(eq(patchTemplates.id, target.id))
            .limit(1);
          if (row?.snapshot?.length) {
            Y.applyUpdate(doc, new Uint8Array(row.snapshot));
            ylog.debug(
              { templateId: target.id, bytes: row.snapshot.length },
              "loaded template snapshot from db",
            );
          } else {
            ylog.debug({ templateId: target.id }, "no template snapshot; empty doc");
          }
        } catch (err) {
          ylog.error({ err, docname }, "load snapshot failed");
        } finally {
          const onUpdate = () => {
            schedulePersist(docname, doc);
          };
          doc.on("update", onUpdate);
          // Catch-up persist if WebSocket merged updates before the listener existed.
          schedulePersist(docname, doc);
        }
      })();
    },
    async writeState(docname: string, doc: WSSharedDoc): Promise<void> {
      const prev = docTimers.get(docname);
      if (prev) clearTimeout(prev);
      docTimers.delete(docname);
      ylog.debug({ docname }, "writeState (flush)");
      await persistSnapshot(docname, doc);
    },
    provider: null,
  };
}
