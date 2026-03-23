import websocket from "@fastify/websocket";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import type { Op, Sheet } from "@fortune-sheet/core";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  patchTemplates,
  performanceWorkbooks,
  performances,
} from "../db/schema.js";
import { broadcastInvalidate } from "../lib/realtime-bus.js";
import { createLogger } from "../lib/log.js";
import { createDefaultPatchWorkbookSheets } from "../lib/default-patch-sheets.js";
import {
  applyOpBatchToSheets,
  hydrateSheetsForCollabRoom,
  sheetsFromJsonb,
  sheetsSafeForCollabPersist,
} from "../lib/workbook-ops.js";

const WS_MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const PERSIST_DEBOUNCE_MS = 1500;
/** Guard duplicate Fortune `addSheet` bursts from one click (same socket, different UUIDs). */
const ADD_SHEET_SOCKET_COOLDOWN_MS = 220;

const relayLog = createLogger("collab-ws-relay");

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const clientMessageSchema = z.object({
  type: z.literal("op"),
  data: z.array(z.unknown()),
});

type RoomKind = "performance" | "template";
type CollabSocket = { send: (s: string) => void; close: () => void };

type RoomState = {
  kind: RoomKind;
  entityId: string;
  sockets: Set<CollabSocket>;
  sheets: Sheet[];
  persistTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
  /** Incremented on each successful in-memory mutation; used to avoid clearing `dirty` after a stale DB write. */
  sheetMutationSeq: number;
  /** Serializes `persistRoom` so overlapping awaits cannot write an older snapshot last (timer + disconnect). */
  persistTail: Promise<void>;
  /** Last accepted `addSheet` batch time by socket (ms since epoch). */
  lastAddSheetAtBySocket: Map<CollabSocket, number>;
};

const rooms = new Map<string, RoomState>();

function roomKey(kind: RoomKind, id: string): string {
  return `${kind}:${id}`;
}

async function loadSheetsForPerformance(performanceId: string): Promise<Sheet[]> {
  const [row] = await db
    .select({ sheetsJson: performanceWorkbooks.sheetsJson })
    .from(performanceWorkbooks)
    .where(eq(performanceWorkbooks.performanceId, performanceId))
    .limit(1);
  return sheetsFromJsonb(row?.sheetsJson ?? []);
}

async function loadSheetsForTemplate(templateId: string): Promise<Sheet[]> {
  const [row] = await db
    .select({ sheetsJson: patchTemplates.sheetsJson })
    .from(patchTemplates)
    .where(eq(patchTemplates.id, templateId))
    .limit(1);
  return sheetsFromJsonb(row?.sheetsJson ?? []);
}

async function persistRoom(room: RoomState): Promise<void> {
  if (!room.dirty) return;
  if (!sheetsSafeForCollabPersist(room.sheets)) {
    relayLog.warn(
      { kind: room.kind, id: room.entityId, sheetCount: room.sheets.length },
      "skip persist: sheets failed minimum persist checks",
    );
    return;
  }
  const storageKey = roomKey(room.kind, room.entityId);
  const seqAtClone = room.sheetMutationSeq;
  const payload = structuredClone(room.sheets) as unknown[];
  let serializedBytes = 0;
  try {
    if (room.kind === "performance") {
      await db
        .insert(performanceWorkbooks)
        .values({
          performanceId: room.entityId,
          sheetsJson: payload,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: performanceWorkbooks.performanceId,
          set: { sheetsJson: payload, updatedAt: new Date() },
        });
    } else {
      await db
        .update(patchTemplates)
        .set({ sheetsJson: payload, updatedAt: new Date() })
        .where(eq(patchTemplates.id, room.entityId));
      broadcastInvalidate([["patchTemplates"], ["patchTemplate"], ["events"]]);
    }
    const logSizes =
      process.env.LOG_LEVEL === "debug" || process.env.LOG_LEVEL === "trace";
    if (logSizes) {
      try {
        serializedBytes = JSON.stringify(payload).length;
      } catch {
        serializedBytes = -1;
      }
    }
    if (room.sheetMutationSeq !== seqAtClone) {
      room.dirty = true;
      schedulePersist(storageKey, room);
      relayLog.debug(
        {
          kind: room.kind,
          id: room.entityId,
          seqAtClone,
          sheetMutationSeq: room.sheetMutationSeq,
          serializedBytes: serializedBytes > 0 ? serializedBytes : undefined,
        },
        "workbook persisted; follow-up flush scheduled (edits during write)",
      );
    } else {
      room.dirty = false;
      relayLog.debug(
        {
          kind: room.kind,
          id: room.entityId,
          seqAtClone,
          serializedBytes: serializedBytes > 0 ? serializedBytes : undefined,
        },
        "workbook persisted",
      );
      if (room.sockets.size === 0) {
        rooms.delete(storageKey);
      }
    }
  } catch (err) {
    relayLog.error({ err, kind: room.kind, id: room.entityId }, "persist failed");
  }
}

/** Run `persistRoom` after all prior enqueued persists for this room finish (avoids stale last-writer wins). */
function enqueuePersist(room: RoomState, key: string): Promise<void> {
  const next = room.persistTail.then(() => persistRoom(room));
  room.persistTail = next.catch((err) => {
    relayLog.error({ err, key }, "persist chain error");
  });
  return next;
}

function schedulePersist(key: string, room: RoomState): void {
  room.dirty = true;
  if (room.persistTimer) clearTimeout(room.persistTimer);
  room.persistTimer = setTimeout(() => {
    room.persistTimer = null;
    void enqueuePersist(room, key);
  }, PERSIST_DEBOUNCE_MS);
}

function broadcastOp(room: RoomState, exclude: { send: (s: string) => void }, ops: Op[]): void {
  const msg = JSON.stringify({ type: "op", data: ops });
  for (const sock of room.sockets) {
    if (sock !== exclude && sock.send) {
      try {
        sock.send(msg);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Tab / whole-workbook structural batches: peers get server truth as fullState (see REALTIME.md). */
function batchHasStructuralOps(ops: Op[]): boolean {
  for (const op of ops) {
    if (op.op === "addSheet" || op.op === "deleteSheet") return true;
    if (op.op === "replace" && op.path?.[0] === "luckysheetfile") return true;
  }
  return false;
}

/** Compact summary for `LOG_LEVEL=debug` (no cell payloads). */
function collabOpBatchSummary(ops: Op[]): {
  opCount: number;
  kinds: string;
  addSheetIds: string[];
} {
  const kinds: string[] = [];
  const addSheetIds: string[] = [];
  for (const op of ops) {
    if (typeof op.op === "string") kinds.push(op.op);
    if (op.op === "addSheet" && op.value && typeof op.value === "object") {
      const id = (op.value as { id?: unknown }).id;
      const s = id == null ? "" : String(id).trim();
      addSheetIds.push(s === "" ? "(no-id)" : s.length > 24 ? `${s.slice(0, 24)}…` : s);
    }
  }
  return {
    opCount: ops.length,
    kinds: kinds.slice(0, 14).join(","),
    addSheetIds,
  };
}

function wsIncomingByteLength(raw: Buffer | string): number {
  return typeof raw === "string" ? raw.length : raw.length;
}

function batchContainsAddSheet(ops: Op[]): boolean {
  for (const op of ops) {
    if (op.op === "addSheet") return true;
  }
  return false;
}

function shouldDropRapidAddSheetBurst(
  room: RoomState,
  sock: CollabSocket,
  ops: Op[],
): boolean {
  if (!batchContainsAddSheet(ops)) return false;
  const now = Date.now();
  const last = room.lastAddSheetAtBySocket.get(sock) ?? 0;
  if (now - last < ADD_SHEET_SOCKET_COOLDOWN_MS) {
    return true;
  }
  room.lastAddSheetAtBySocket.set(sock, now);
  return false;
}

function broadcastFullStateToPeers(
  room: RoomState,
  exclude: { send: (s: string) => void },
  sheets: Sheet[],
): void {
  const msg = JSON.stringify({ type: "fullState", sheets: structuredClone(sheets) });
  for (const sock of room.sockets) {
    if (sock !== exclude && sock.send) {
      try {
        sock.send(msg);
      } catch {
        /* ignore */
      }
    }
  }
}

function sendFullState(sock: { send: (s: string) => void }, sheets: Sheet[]): void {
  sock.send(JSON.stringify({ type: "fullState", sheets }));
}

/** Push full workbook to all sockets in a performance room (e.g. after REST import). */
export function broadcastFullStateToPerformanceRoom(
  performanceId: string,
  sheets: Sheet[],
): void {
  const key = roomKey("performance", performanceId);
  const room = rooms.get(key);
  if (!room) return;
  room.sheets = structuredClone(sheets);
  room.dirty = true;
  room.sheetMutationSeq += 1;
  const msg = JSON.stringify({ type: "fullState", sheets: room.sheets });
  for (const sock of room.sockets) {
    try {
      sock.send(msg);
    } catch {
      /* ignore */
    }
  }
  schedulePersist(key, room);
}

/** Push full workbook to all sockets in a template room. */
export function broadcastFullStateToTemplateRoom(templateId: string, sheets: Sheet[]): void {
  const key = roomKey("template", templateId);
  const room = rooms.get(key);
  if (!room) return;
  room.sheets = structuredClone(sheets);
  room.dirty = true;
  room.sheetMutationSeq += 1;
  const msg = JSON.stringify({ type: "fullState", sheets: room.sheets });
  for (const sock of room.sockets) {
    try {
      sock.send(msg);
    } catch {
      /* ignore */
    }
  }
  schedulePersist(key, room);
}

/** Flush all rooms to Postgres (graceful shutdown). */
export async function flushCollabRelayRooms(): Promise<void> {
  for (const room of rooms.values()) {
    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
      room.persistTimer = null;
    }
  }
  const list = Array.from(rooms.values());
  rooms.clear();
  await Promise.all(
    list.map((r) => r.persistTail.then(() => persistRoom(r))),
  );
  relayLog.info({ count: list.length }, "collab relay rooms flushed");
}

type CollabParams = { Params: { performanceId: string } };
type TemplateCollabParams = { Params: { templateId: string } };

export const collabWsRelayPlugin: FastifyPluginAsync = async (app) => {
  await app.register(websocket, {
    options: { maxPayload: WS_MAX_PAYLOAD_BYTES },
  });

  async function getOrCreateRoom(
    kind: RoomKind,
    entityId: string,
  ): Promise<RoomState> {
    const key = roomKey(kind, entityId);
    let room = rooms.get(key);
    if (room) return room;
    const raw =
      kind === "performance"
        ? await loadSheetsForPerformance(entityId)
        : await loadSheetsForTemplate(entityId);
    let sheets: Sheet[];
    let seededDefault = false;
    // Match `sheetsSafeForCollabPersist` (relay writes): Fortune `addSheet` tabs may lack `data` /
    // `celldata` until hydrated — `sheetsUsableForServing` would falsely drop the whole workbook.
    if (sheetsSafeForCollabPersist(raw)) {
      sheets = structuredClone(raw);
      hydrateSheetsForCollabRoom(sheets);
    } else {
      sheets = structuredClone(createDefaultPatchWorkbookSheets());
      seededDefault = true;
    }
    room = {
      kind,
      entityId,
      sockets: new Set(),
      sheets,
      persistTimer: null,
      dirty: seededDefault,
      sheetMutationSeq: 0,
      persistTail: Promise.resolve(),
      lastAddSheetAtBySocket: new Map(),
    };
    rooms.set(key, room);
    if (seededDefault) schedulePersist(key, room);
    return room;
  }

  function removeSocket(
    key: string,
    room: RoomState,
    sock: { send: (s: string) => void; close: () => void },
  ): void {
    room.sockets.delete(sock);
    room.lastAddSheetAtBySocket.delete(sock);
    if (room.sockets.size === 0) {
      if (room.persistTimer) {
        clearTimeout(room.persistTimer);
        room.persistTimer = null;
      }
      void enqueuePersist(room, key)
        .catch((err) => relayLog.error({ err, key }, "persistRoom rejected"))
        .finally(() => {
          if (room.sockets.size > 0) return;
          if (room.dirty) {
            relayLog.warn(
              { kind: room.kind, id: room.entityId, key },
              "collab room closed with unsaved sheets; keeping in-memory room for reconnect",
            );
            return;
          }
          rooms.delete(key);
        });
    }
  }

  app.get<CollabParams>(
    "/ws/v1/collab/:performanceId",
    { websocket: true },
    async (socket, req: FastifyRequest<CollabParams>) => {
      const id = req.params.performanceId;
      if (!id || !uuidRe.test(id)) {
        relayLog.warn({ performanceId: id }, "reject: invalid performance id");
        socket.close(1008, "Invalid performance id");
        return;
      }
      const [perf] = await db
        .select({ id: performances.id })
        .from(performances)
        .where(eq(performances.id, id))
        .limit(1);
      if (!perf) {
        relayLog.warn({ performanceId: id }, "reject: performance not found");
        socket.close(1008, "Performance not found");
        return;
      }

      const key = roomKey("performance", id);
      const room = await getOrCreateRoom("performance", id);
      const sock = socket as unknown as { send: (s: string) => void; close: () => void };
      room.sockets.add(sock);
      sendFullState(sock, room.sheets);
      relayLog.debug({ performanceId: id, peers: room.sockets.size }, "relay connected");

      socket.on("message", (raw: Buffer | string) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
        } catch {
          relayLog.debug(
            { performanceId: id, byteLength: wsIncomingByteLength(raw) },
            "collab ws: client json parse failed",
          );
          return;
        }
        const msg = clientMessageSchema.safeParse(parsed);
        if (!msg.success) {
          relayLog.warn(
            {
              performanceId: id,
              issues: msg.error.issues.slice(0, 6).map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            },
            "collab ws: client message rejected",
          );
          return;
        }
        const ops = msg.data.data as Op[];
        if (!Array.isArray(ops)) {
          relayLog.warn({ performanceId: id }, "collab ws: op payload is not an array");
          return;
        }
        if (shouldDropRapidAddSheetBurst(room, sock, ops)) {
          relayLog.warn(
            { performanceId: id, ...collabOpBatchSummary(ops) },
            "drop rapid duplicate addSheet batch from same socket",
          );
          try {
            sendFullState(sock, room.sheets);
          } catch {
            /* ignore */
          }
          return;
        }
        try {
          applyOpBatchToSheets(room.sheets, ops);
        } catch (err) {
          relayLog.warn({ err, performanceId: id }, "applyOp batch failed on server");
          try {
            sendFullState(sock, room.sheets);
          } catch {
            /* ignore */
          }
          return;
        }
        const structural = batchHasStructuralOps(ops);
        if (structural) {
          broadcastFullStateToPeers(room, sock, room.sheets);
        } else {
          broadcastOp(room, sock, ops);
        }
        room.sheetMutationSeq += 1;
        schedulePersist(key, room);
        relayLog.debug(
          {
            performanceId: id,
            peers: room.sockets.size,
            broadcast: structural ? "fullState-to-peers" : "op",
            sheetCount: room.sheets.length,
            structural,
            ...collabOpBatchSummary(ops),
          },
          "relay op batch applied",
        );
      });

      socket.on("close", () => {
        removeSocket(key, room, sock);
        relayLog.debug({ performanceId: id }, "relay disconnected");
      });
    },
  );

  app.get<TemplateCollabParams>(
    "/ws/v1/collab-template/:templateId",
    { websocket: true },
    async (socket, req: FastifyRequest<TemplateCollabParams>) => {
      const id = req.params.templateId;
      if (!id || !uuidRe.test(id)) {
        relayLog.warn({ templateId: id }, "reject: invalid template id");
        socket.close(1008, "Invalid template id");
        return;
      }
      const [tpl] = await db
        .select({ id: patchTemplates.id })
        .from(patchTemplates)
        .where(eq(patchTemplates.id, id))
        .limit(1);
      if (!tpl) {
        relayLog.warn({ templateId: id }, "reject: template not found");
        socket.close(1008, "Template not found");
        return;
      }

      const key = roomKey("template", id);
      const room = await getOrCreateRoom("template", id);
      const sock = socket as unknown as { send: (s: string) => void; close: () => void };
      room.sockets.add(sock);
      sendFullState(sock, room.sheets);
      relayLog.debug({ templateId: id, peers: room.sockets.size }, "template relay connected");

      socket.on("message", (raw: Buffer | string) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
        } catch {
          relayLog.debug(
            { templateId: id, byteLength: wsIncomingByteLength(raw) },
            "collab ws: client json parse failed",
          );
          return;
        }
        const msg = clientMessageSchema.safeParse(parsed);
        if (!msg.success) {
          relayLog.warn(
            {
              templateId: id,
              issues: msg.error.issues.slice(0, 6).map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            },
            "collab ws: client message rejected",
          );
          return;
        }
        const ops = msg.data.data as Op[];
        if (!Array.isArray(ops)) {
          relayLog.warn({ templateId: id }, "collab ws: op payload is not an array");
          return;
        }
        if (shouldDropRapidAddSheetBurst(room, sock, ops)) {
          relayLog.warn(
            { templateId: id, ...collabOpBatchSummary(ops) },
            "drop rapid duplicate addSheet batch from same socket",
          );
          try {
            sendFullState(sock, room.sheets);
          } catch {
            /* ignore */
          }
          return;
        }
        try {
          applyOpBatchToSheets(room.sheets, ops);
        } catch (err) {
          relayLog.warn({ err, templateId: id }, "applyOp batch failed on server");
          try {
            sendFullState(sock, room.sheets);
          } catch {
            /* ignore */
          }
          return;
        }
        const structural = batchHasStructuralOps(ops);
        if (structural) {
          broadcastFullStateToPeers(room, sock, room.sheets);
        } else {
          broadcastOp(room, sock, ops);
        }
        room.sheetMutationSeq += 1;
        schedulePersist(key, room);
        relayLog.debug(
          {
            templateId: id,
            peers: room.sockets.size,
            broadcast: structural ? "fullState-to-peers" : "op",
            sheetCount: room.sheets.length,
            structural,
            ...collabOpBatchSummary(ops),
          },
          "relay op batch applied",
        );
      });

      socket.on("close", () => {
        removeSocket(key, room, sock);
        relayLog.debug({ templateId: id }, "template relay disconnected");
      });
    },
  );
};
