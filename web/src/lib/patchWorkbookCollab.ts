import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import type { WorkbookInstance } from "@fortune-sheet/react";
import type { Op, Sheet } from "@fortune-sheet/core";
import { logClientDebugCollab, summarizeOpsForClientLog } from "./clientDebugLog";
import { logDebug } from "./debug";
import { normalizeSheetsForFortuneMount } from "./fortuneSheetMountNormalize";
import { usePageVisible } from "../hooks/usePageVisible";

const WS_INITIAL_BACKOFF_MS = 300;
const WS_MAX_BACKOFF_MS = 10_000;

type WsMessage =
  | { type: "fullState"; sheets: Sheet[] }
  | { type: "op"; data: Op[] };

function fullDataRange(sheet: Sheet): { row: [number, number]; column: [number, number] } {
  const data = sheet.data;
  const rowLen = Array.isArray(data) ? data.length : 0;
  const rowMax = Math.max(0, (rowLen > 0 ? rowLen : 1) - 1);
  const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const colLen = Array.isArray(first) ? first.length : 0;
  const colMax = Math.max(0, (colLen > 0 ? colLen : 1) - 1);
  if (!Number.isFinite(rowMax) || !Number.isFinite(colMax)) {
    return { row: [0, 0], column: [0, 0] };
  }
  return { row: [0, rowMax], column: [0, colMax] };
}

function getActiveSheetId(wb: WorkbookInstance): string | undefined {
  const sheets = wb.getAllSheets() as Sheet[];
  const active = sheets.find((s) => s.status === 1);
  if (active?.id == null || String(active.id).trim() === "") return undefined;
  return String(active.id);
}

function preserveActiveSheetInSnapshot(sheets: Sheet[], activeSheetId: string | undefined): void {
  if (!activeSheetId) return;
  let found = false;
  for (const sheet of sheets) {
    const sid = sheet.id == null ? "" : String(sheet.id);
    if (sid === activeSheetId) {
      sheet.status = 1;
      found = true;
    } else if (sheet.status === 1) {
      sheet.status = 0;
    }
  }
  if (!found) return;
}

function batchHasStructuralOps(ops: Op[]): boolean {
  for (const o of ops) {
    if (o.op === "addSheet" || o.op === "deleteSheet") return true;
    if (
      o.op === "replace" &&
      o.path?.[0] === "luckysheetfile" &&
      Array.isArray(o.path) &&
      o.path.length === 1
    ) {
      return true;
    }
  }
  return false;
}

/** After remote `applyOp`, refresh formulas without pushing ops to the server. */
function flushRemoteFormulaRecalc(
  wb: WorkbookInstance,
  suppressLocalOpsRef: MutableRefObject<boolean>,
): void {
  suppressLocalOpsRef.current = true;
  try {
    const sheets = wb.getAllSheets() as Sheet[];
    for (const sheet of sheets) {
      const sheetId = sheet.id;
      if (sheetId == null || sheetId === "") continue;
      try {
        const range = fullDataRange(sheet);
        flushSync(() => {
          wb.batchCallApis([{ name: "calculateFormula", args: [sheetId, range] }]);
        });
      } catch (e) {
        logDebug("patch-workbook-collab", "per-sheet calculateFormula skipped", { sheetId }, e);
      }
    }
    try {
      flushSync(() => {
        wb.calculateFormula();
      });
      flushSync(() => {
        wb.calculateFormula();
      });
    } catch (e) {
      logDebug("patch-workbook-collab", "calculateFormula failed after remote op", e);
    }
  } finally {
    /* One frame after the current stack — shorter than double rAF so local `onOp` is less likely to drop
     * while another tab’s cell ops are being merged (suppress blocked outbound edits). */
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        suppressLocalOpsRef.current = false;
      });
    });
  }
}

export type PatchWorkbookCollabMode = "performance" | "template";

/**
 * WebSocket op relay + FortuneSheet (FortuneSheet upstream collab pattern).
 */
export function usePatchWorkbookCollab(opts: {
  roomId: string | undefined;
  mode: PatchWorkbookCollabMode;
  /** When true, `<Workbook>` can mount (parent finished loading domain row). */
  workbookReady: boolean;
  onLocalOp?: () => void;
  pauseWhenHidden?: boolean;
  readOnly?: boolean;
}): {
  wbRef: RefObject<WorkbookInstance | null>;
  onOp: (ops: Op[]) => void;
  conn: "connecting" | "connected" | "error";
  /** Sheets from server `fullState`; null until first message. */
  workbookSheets: Sheet[] | null;
  workbookHydrated: boolean;
  /** Bump with `Workbook` `key` so mid-session `fullState` remounts the grid (structural collab). */
  workbookDataRev: number;
} {
  const { roomId, mode, workbookReady, onLocalOp, pauseWhenHidden = false, readOnly = false } =
    opts;
  const wbRef = useRef<WorkbookInstance>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLocalOpsRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const roomIdRef = useRef<string | undefined>(roomId);
  roomIdRef.current = roomId;
  /** Batches NDJSON lines for non-structural `onOp` sends (cell edits) — see docs/LOGGING.md. */
  const cellOutboundAggRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    batches: number;
    opCount: number;
    lastHead: string;
  }>({ timer: null, batches: 0, opCount: 0, lastHead: "" });
  /** After first `fullState` of this WS session, further `fullState` messages bump {@link workbookDataRev}. */
  const awaitingFirstFullStateRef = useRef(true);
  const pageVisible = usePageVisible();

  const [conn, setConn] = useState<"connecting" | "connected" | "error">("connecting");
  const [workbookSheets, setWorkbookSheets] = useState<Sheet[] | null>(null);
  const [workbookHydrated, setWorkbookHydrated] = useState(false);
  const [workbookDataRev, setWorkbookDataRev] = useState(0);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connectWs = useCallback(() => {
    if (!roomId) return;
    clearReconnectTimer();
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const path =
      mode === "template" ? "/ws/v1/collab-template" : "/ws/v1/collab";
    const url = `${proto}//${window.location.host}${path}/${roomId}`;

    try {
      const oldWs = wsRef.current;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setConn("connecting");

      ws.onopen = () => {
        if (wsRef.current !== ws) return;
        reconnectAttemptRef.current = 0;
        awaitingFirstFullStateRef.current = true;
        setConn("connected");
        logDebug("patch-workbook-collab", "websocket open", { roomId, mode });
      };

      ws.onmessage = (ev) => {
        if (wsRef.current !== ws) return;
        let msg: WsMessage;
        try {
          msg = JSON.parse(ev.data as string) as WsMessage;
        } catch {
          return;
        }
        if (msg.type === "fullState" && Array.isArray(msg.sheets)) {
          const midSession = !awaitingFirstFullStateRef.current;
          const activeSheetIdBeforeRemount =
            midSession && wbRef.current ? getActiveSheetId(wbRef.current) : undefined;
          const nextSheets = structuredClone(msg.sheets) as Sheet[];
          preserveActiveSheetInSnapshot(nextSheets, activeSheetIdBeforeRemount);
          logClientDebugCollab("patch-workbook-collab", "fullState received", {
            roomId,
            sheetCount: msg.sheets.length,
            midSessionRemount: midSession,
            activeSheetIdBeforeRemount,
          });
          setWorkbookSheets(normalizeSheetsForFortuneMount(nextSheets));
          if (midSession) {
            setWorkbookDataRev((r) => r + 1);
          } else {
            awaitingFirstFullStateRef.current = false;
          }
          setWorkbookHydrated(true);
          return;
        }
        if (msg.type === "op" && Array.isArray(msg.data)) {
          const wb = wbRef.current;
          if (!wb) return;
          try {
            const batch = msg.data as Op[];
            if (batch.length === 0) return;
            if (batchHasStructuralOps(batch)) {
              logClientDebugCollab("patch-workbook-collab", "remote op batch (structural)", {
                roomId,
                ...summarizeOpsForClientLog(batch),
              });
            }
            wb.applyOp(batch);
            flushRemoteFormulaRecalc(wb, suppressLocalOpsRef);
          } catch (e) {
            logDebug("patch-workbook-collab", "applyOp failed for remote batch", e);
            logClientDebugCollab("patch-workbook-collab", "applyOp failed for remote batch", {
              roomId,
              ...summarizeOpsForClientLog((msg.data as Op[]) ?? []),
            });
          }
        }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        setConn("error");
        logDebug("patch-workbook-collab", "websocket error", { roomId });
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        if (intentionalDisconnectRef.current) {
          intentionalDisconnectRef.current = false;
          setConn("connecting");
          logDebug("patch-workbook-collab", "websocket closed (intentional)", { roomId });
          return;
        }
        setConn("connecting");
        setWorkbookHydrated(false);
        setWorkbookSheets(null);
        awaitingFirstFullStateRef.current = true;
        setWorkbookDataRev(0);
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(
          WS_MAX_BACKOFF_MS,
          WS_INITIAL_BACKOFF_MS * 2 ** Math.min(attempt - 1, 8),
        );
        reconnectTimerRef.current = setTimeout(() => {
          connectWs();
        }, delay);
        logDebug("patch-workbook-collab", "websocket closed; scheduling reconnect", {
          roomId,
          delayMs: delay,
        });
      };

      if (oldWs && oldWs !== ws) {
        oldWs.close();
      }
    } catch {
      setConn("error");
    }
  }, [roomId, mode, clearReconnectTimer]);

  useEffect(() => {
    if (!roomId || !workbookReady) {
      clearReconnectTimer();
      const w = wsRef.current;
      if (w) {
        logClientDebugCollab("patch-workbook-collab", "collab ws closing (room idle — not ready)", {
          roomId: roomId ?? "none",
          workbookReady,
          hadSocket: true,
        });
      }
      wsRef.current = null;
      w?.close();
      setConn("connecting");
      setWorkbookHydrated(false);
      setWorkbookSheets(null);
      awaitingFirstFullStateRef.current = true;
      setWorkbookDataRev(0);
      return;
    }
    connectWs();
    return () => {
      clearReconnectTimer();
      logClientDebugCollab("patch-workbook-collab", "collab ws closing (navigate or reload room)", {
        roomId,
        workbookReady,
        hadSocket: Boolean(wsRef.current),
      });
      const w = wsRef.current;
      wsRef.current = null;
      w?.close();
    };
  }, [roomId, workbookReady, connectWs, clearReconnectTimer]);

  useEffect(() => {
    return () => {
      const acc = cellOutboundAggRef.current;
      if (acc.timer != null) {
        clearTimeout(acc.timer);
        acc.timer = null;
      }
      if (acc.batches > 0) {
        const rid = roomIdRef.current;
        if (rid) {
          logClientDebugCollab("patch-workbook-collab", "outbound cell op batches (aggregated, flush)", {
            roomId: rid,
            aggregatedBatches: acc.batches,
            aggregatedOpCount: acc.opCount,
            lastBatchHead: acc.lastHead,
          });
        }
        acc.batches = 0;
        acc.opCount = 0;
        acc.lastHead = "";
      }
    };
  }, []);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (!pauseWhenHidden) return;
    if (!workbookHydrated) return;
    if (!pageVisible) {
      clearReconnectTimer();
      ws.close();
      logDebug("patch-workbook-collab", "page hidden — closing websocket");
    } else {
      connectWs();
      logDebug("patch-workbook-collab", "page visible — reconnecting websocket");
    }
  }, [pauseWhenHidden, pageVisible, workbookHydrated, connectWs, clearReconnectTimer]);

  const onOp = useCallback(
    (ops: Op[]) => {
      if (readOnly) {
        logClientDebugCollab("patch-workbook-collab", "onOp skipped: readOnly", { roomId });
        return;
      }
      if (suppressLocalOpsRef.current) {
        logClientDebugCollab("patch-workbook-collab", "onOp skipped: suppressLocalOps", {
          roomId,
        });
        return;
      }
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        logClientDebugCollab("patch-workbook-collab", "onOp skipped: websocket not open", {
          roomId,
          readyState: ws?.readyState ?? -1,
        });
        return;
      }
      onLocalOp?.();
      try {
        ws.send(JSON.stringify({ type: "op", data: ops }));
        if (batchHasStructuralOps(ops)) {
          const acc = cellOutboundAggRef.current;
          if (acc.timer != null) {
            clearTimeout(acc.timer);
            acc.timer = null;
          }
          if (acc.batches > 0) {
            const rid = roomIdRef.current;
            if (rid) {
              logClientDebugCollab(
                "patch-workbook-collab",
                "outbound cell op batches (aggregated, before structural)",
                {
                  roomId: rid,
                  aggregatedBatches: acc.batches,
                  aggregatedOpCount: acc.opCount,
                  lastBatchHead: acc.lastHead,
                },
              );
            }
            acc.batches = 0;
            acc.opCount = 0;
            acc.lastHead = "";
          }
          logClientDebugCollab("patch-workbook-collab", "outbound structural op batch sent", {
            roomId,
            ...summarizeOpsForClientLog(ops),
          });
        } else {
          const sum = summarizeOpsForClientLog(ops);
          const acc = cellOutboundAggRef.current;
          acc.batches += 1;
          acc.opCount += sum.count;
          acc.lastHead = sum.head;
          if (acc.timer == null) {
            acc.timer = setTimeout(() => {
              const a = cellOutboundAggRef.current;
              a.timer = null;
              if (a.batches === 0) return;
              const rid = roomIdRef.current;
              if (rid) {
                logClientDebugCollab(
                  "patch-workbook-collab",
                  "outbound cell op batches (aggregated)",
                  {
                    roomId: rid,
                    aggregatedBatches: a.batches,
                    aggregatedOpCount: a.opCount,
                    lastBatchHead: a.lastHead,
                  },
                );
              }
              a.batches = 0;
              a.opCount = 0;
              a.lastHead = "";
            }, 450);
          }
        }
      } catch (e) {
        logDebug("patch-workbook-collab", "send op failed", e);
        logClientDebugCollab("patch-workbook-collab", "send op failed", {
          roomId,
          ...summarizeOpsForClientLog(ops),
        });
      }
    },
    [readOnly, onLocalOp, roomId],
  );

  return { wbRef, onOp, conn, workbookSheets, workbookHydrated, workbookDataRev };
}
