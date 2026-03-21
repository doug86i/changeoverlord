import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { WorkbookInstance } from "@fortune-sheet/react";
import type { Op, Sheet } from "@fortune-sheet/core";
import { logDebug } from "./debug";
import {
  PATCH_WORKBOOK_Y_ORIGIN,
  usePatchWorkbookOpLogEffects,
} from "./patchWorkbookYjs";

/** Minimal valid sheet so `<Workbook>` can mount. Yjs opLog replay overwrites immediately. */
export const WORKBOOK_PLACEHOLDER: Sheet[] = [
  { id: "placeholder", name: "Sheet1", status: 1, row: 36, column: 18, order: 0 },
];

export type PatchWorkbookCollabMode = "performance" | "template";

/**
 * Shared Yjs + FortuneSheet wiring for `/patch/:id` and `/patch-templates/:id/edit`.
 */
export function usePatchWorkbookCollab(opts: {
  roomId: string | undefined;
  mode: PatchWorkbookCollabMode;
  workbookReady: boolean;
  /** Called after each local op is pushed to Yjs (e.g. mark performance workbook dirty). */
  onLocalOp?: () => void;
}): {
  wbRef: RefObject<WorkbookInstance | null>;
  onOp: (ops: Op[]) => void;
  conn: "connecting" | "connected" | "error";
  synced: boolean;
} {
  const { roomId, mode, workbookReady, onLocalOp } = opts;
  const wbRef = useRef<WorkbookInstance>(null);
  /** True while running post-hydration `calculateFormula` — those patches must not become Yjs ops. */
  const suppressYjsOpsForFormulaRecalcRef = useRef(false);
  const [conn, setConn] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [synced, setSynced] = useState(false);

  const ydoc = useMemo(() => new Y.Doc(), [roomId]);
  const yops = useMemo(() => ydoc.getArray<string>("opLog"), [ydoc]);

  const onOp = useCallback(
    (ops: Op[]) => {
      if (suppressYjsOpsForFormulaRecalcRef.current) return;
      onLocalOp?.();
      ydoc.transact(() => {
        yops.push([JSON.stringify(ops)]);
      }, PATCH_WORKBOOK_Y_ORIGIN);
    },
    [ydoc, yops, onLocalOp],
  );

  useEffect(() => {
    if (!roomId) return;

    setSynced(false);

    if (mode === "template") {
      logDebug("patch-workbook", "Template editor Yjs provider starting", {
        templateId: roomId,
      });
    } else {
      logDebug("patch-workbook", "PatchPage Yjs provider starting", {
        performanceId: roomId,
      });
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const path =
      mode === "template" ? "/ws/v1/collab-template" : "/ws/v1/collab";
    const base = `${proto}//${window.location.host}${path}`;
    const provider = new WebsocketProvider(base, roomId, ydoc, {
      connect: true,
    });

    const onStatus = (ev: { status: string }) => {
      logDebug("patch-workbook", "y-websocket status", ev.status);
      if (ev.status === "connected") setConn("connected");
      if (ev.status === "disconnected") setConn("connecting");
    };
    const onSync = (isSynced: boolean) => {
      logDebug("patch-workbook", "y-websocket synced", isSynced);
      setSynced(isSynced);
    };
    const onErr = () => {
      logDebug("patch-workbook", "y-websocket connection-error");
      setConn("error");
    };

    provider.on("status", onStatus);
    provider.on("sync", onSync);
    provider.on("connection-error", onErr);

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId, ydoc, mode]);

  usePatchWorkbookOpLogEffects(
    roomId,
    yops,
    wbRef,
    synced,
    workbookReady,
    suppressYjsOpsForFormulaRecalcRef,
  );

  return { wbRef, onOp, conn, synced };
}
