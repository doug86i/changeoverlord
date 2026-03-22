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
import { logDebug } from "./debug";
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

function sheetIdExists(wb: WorkbookInstance, id: string): boolean {
  return (wb.getAllSheets() as Sheet[]).some(
    (s) => s.id != null && String(s.id) === id,
  );
}

/** After remote `applyOp`, refresh formulas without pushing ops to the server. */
function flushRemoteFormulaRecalc(
  wb: WorkbookInstance,
  suppressLocalOpsRef: MutableRefObject<boolean>,
): void {
  suppressLocalOpsRef.current = true;
  try {
    const savedActiveId = getActiveSheetId(wb);
    const sheets = wb.getAllSheets() as Sheet[];
    for (const sheet of sheets) {
      const sheetId = sheet.id;
      if (sheetId == null || sheetId === "") continue;
      try {
        const range = fullDataRange(sheet);
        flushSync(() => {
          wb.batchCallApis([
            { name: "activateSheet", args: [{ id: sheetId }] },
            { name: "calculateFormula", args: [sheetId, range] },
          ]);
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
    if (savedActiveId && sheetIdExists(wb, savedActiveId)) {
      const current = (wb.getAllSheets() as Sheet[]).find(
        (s) => s.id != null && String(s.id) === savedActiveId,
      );
      const restoreId = current?.id;
      if (restoreId != null && restoreId !== "") {
        try {
          flushSync(() => {
            wb.batchCallApis([{ name: "activateSheet", args: [{ id: restoreId }] }]);
          });
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    requestAnimationFrame(() => {
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
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setConn("connecting");

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        awaitingFirstFullStateRef.current = true;
        setConn("connected");
        logDebug("patch-workbook-collab", "websocket open", { roomId, mode });
      };

      ws.onmessage = (ev) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(ev.data as string) as WsMessage;
        } catch {
          return;
        }
        if (msg.type === "fullState" && Array.isArray(msg.sheets)) {
          setWorkbookSheets(structuredClone(msg.sheets));
          if (!awaitingFirstFullStateRef.current) {
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
            wb.applyOp(batch);
            flushRemoteFormulaRecalc(wb, suppressLocalOpsRef);
          } catch (e) {
            logDebug("patch-workbook-collab", "applyOp failed for remote batch", e);
          }
        }
      };

      ws.onerror = () => {
        setConn("error");
        logDebug("patch-workbook-collab", "websocket error", { roomId });
      };

      ws.onclose = () => {
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
    } catch {
      setConn("error");
    }
  }, [roomId, mode, clearReconnectTimer]);

  useEffect(() => {
    if (!roomId || !workbookReady) return;
    connectWs();
    return () => {
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [roomId, workbookReady, connectWs, clearReconnectTimer]);

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
      if (readOnly) return;
      if (suppressLocalOpsRef.current) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      onLocalOp?.();
      try {
        ws.send(JSON.stringify({ type: "op", data: ops }));
      } catch (e) {
        logDebug("patch-workbook-collab", "send op failed", e);
      }
    },
    [readOnly, onLocalOp],
  );

  return { wbRef, onOp, conn, workbookSheets, workbookHydrated, workbookDataRev };
}
