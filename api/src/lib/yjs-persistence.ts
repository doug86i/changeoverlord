import * as Y from "yjs";
import { eq } from "drizzle-orm";
import type { WSSharedDoc } from "@y/websocket-server/utils";
import { db } from "../db/client.js";
import { patchTemplates, performanceYjsSnapshots } from "../db/schema.js";
import { broadcastInvalidate } from "./realtime-bus.js";
import { createLogger } from "./log.js";

const ylog = createLogger("yjs-persist");

const debounceMs = 3000;
const docTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

async function persistSnapshot(
  docname: string,
  doc: WSSharedDoc,
): Promise<void> {
  const target = parseDocName(docname);
  if (!target) return;

  const snapshot = Buffer.from(Y.encodeStateAsUpdate(doc));

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

export function createYjsPersistence() {
  return {
    bindState(docname: string, doc: WSSharedDoc): void {
      const target = parseDocName(docname);
      if (!target) return;

      void (async () => {
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
      })().catch((err) => {
        ylog.error({ err, docname }, "load snapshot failed");
      });

      doc.on("update", () => {
        schedulePersist(docname, doc);
      });
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
