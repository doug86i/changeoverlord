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
  sheetsFromJsonb,
  sheetsLookUsableAfterOpLogReplay,
  sheetsSafeForCollabPersist,
} from "../lib/workbook-ops.js";

const WS_MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const PERSIST_DEBOUNCE_MS = 2000;

const relayLog = createLogger("collab-ws-relay");

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const clientMessageSchema = z.object({
  type: z.literal("op"),
  data: z.array(z.unknown()),
});

type RoomKind = "performance" | "template";

type RoomState = {
  kind: RoomKind;
  entityId: string;
  sockets: Set<{ send: (s: string) => void; close: () => void }>;
  sheets: Sheet[];
  persistTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
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
  const payload = structuredClone(room.sheets) as unknown[];
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
    room.dirty = false;
    relayLog.debug({ kind: room.kind, id: room.entityId }, "workbook persisted");
  } catch (err) {
    relayLog.error({ err, kind: room.kind, id: room.entityId }, "persist failed");
  }
}

function schedulePersist(key: string, room: RoomState): void {
  room.dirty = true;
  if (room.persistTimer) clearTimeout(room.persistTimer);
  room.persistTimer = setTimeout(() => {
    room.persistTimer = null;
    void persistRoom(room).catch((err) =>
      relayLog.error({ err, key }, "debounced persist error"),
    );
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
  await Promise.all(list.map((r) => persistRoom(r)));
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
    if (sheetsLookUsableAfterOpLogReplay(raw)) {
      sheets = structuredClone(raw);
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
    if (room.sockets.size === 0) {
      if (room.persistTimer) {
        clearTimeout(room.persistTimer);
        room.persistTimer = null;
      }
      void persistRoom(room).finally(() => {
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
          return;
        }
        const msg = clientMessageSchema.safeParse(parsed);
        if (!msg.success) return;
        const ops = msg.data.data as Op[];
        if (!Array.isArray(ops)) return;
        try {
          applyOpBatchToSheets(room.sheets, ops);
        } catch (err) {
          relayLog.warn({ err, performanceId: id }, "applyOp batch failed on server");
          return;
        }
        broadcastOp(room, sock, ops);
        schedulePersist(key, room);
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
          return;
        }
        const msg = clientMessageSchema.safeParse(parsed);
        if (!msg.success) return;
        const ops = msg.data.data as Op[];
        if (!Array.isArray(ops)) return;
        try {
          applyOpBatchToSheets(room.sheets, ops);
        } catch (err) {
          relayLog.warn({ err, templateId: id }, "applyOp batch failed on server");
          return;
        }
        broadcastOp(room, sock, ops);
        schedulePersist(key, room);
      });

      socket.on("close", () => {
        removeSocket(key, room, sock);
        relayLog.debug({ templateId: id }, "template relay disconnected");
      });
    },
  );
};
