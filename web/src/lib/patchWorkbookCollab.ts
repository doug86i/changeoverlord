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
import { usePageVisible } from "../hooks/usePageVisible";
import {
  PATCH_WORKBOOK_Y_ORIGIN,
  usePatchWorkbookOpLogEffects,
} from "./patchWorkbookYjs";

/** Minimal valid sheet so `<Workbook>` can mount. Yjs opLog replay overwrites immediately. */
export const WORKBOOK_PLACEHOLDER: Sheet[] = [
  {
    id: "placeholder",
    name: "Sheet1",
    status: 1,
    row: 36,
    column: 18,
    order: 0,
    data: Array.from({ length: 36 }, () => Array.from({ length: 18 }, () => null)),
    calcChain: [],
  },
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
  /**
   * When true, disconnect the collab WebSocket while the tab is hidden or the screen is off
   * (Page Visibility API), then reconnect when visible again — saves battery on phones.
   */
  pauseWhenHidden?: boolean;
  /** When true, local FortuneSheet ops are not pushed to Yjs (read-only viewer; remote ops still apply). */
  readOnly?: boolean;
}): {
  wbRef: RefObject<WorkbookInstance | null>;
  onOp: (ops: Op[]) => void;
  conn: "connecting" | "connected" | "error";
  synced: boolean;
  /** FortuneSheet has replayed Yjs `opLog` (incl. late server snapshot); safe to edit. */
  workbookHydrated: boolean;
} {
  const {
    roomId,
    mode,
    workbookReady,
    onLocalOp,
    pauseWhenHidden = false,
    readOnly = false,
  } = opts;
  const wbRef = useRef<WorkbookInstance>(null);
  const providerRef = useRef<InstanceType<typeof WebsocketProvider> | null>(null);
  const pageVisible = usePageVisible();
  /** True while running post-hydration `calculateFormula` — those patches must not become Yjs ops. */
  const suppressYjsOpsForFormulaRecalcRef = useRef(false);
  /** Synchronous gate so `onOp` ignores input before hydration even if React state lags. */
  const localOpsAllowedRef = useRef(false);
  const [conn, setConn] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [synced, setSynced] = useState(false);
  const [workbookHydrated, setWorkbookHydrated] = useState(false);

  const ydoc = useMemo(() => new Y.Doc(), [roomId ?? ""]);
  const yops = useMemo(() => ydoc.getArray<string>("opLog"), [ydoc]);

  useEffect(() => {
    return () => {
      ydoc.destroy();
    };
  }, [ydoc]);

  const onOp = useCallback(
    (ops: Op[]) => {
      if (readOnly) return;
      if (suppressYjsOpsForFormulaRecalcRef.current) return;
      if (!localOpsAllowedRef.current) return;
      onLocalOp?.();
      ydoc.transact(() => {
        yops.push([JSON.stringify(ops)]);
      }, PATCH_WORKBOOK_Y_ORIGIN);
    },
    [ydoc, yops, onLocalOp, readOnly],
  );

  const onHydrationChange = useCallback((hydrated: boolean) => {
    localOpsAllowedRef.current = hydrated;
    setWorkbookHydrated(hydrated);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    setSynced(false);
    localOpsAllowedRef.current = false;
    setWorkbookHydrated(false);

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
    providerRef.current = provider;

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
      providerRef.current = null;
      provider.destroy();
    };
  }, [roomId, ydoc, mode]);

  useEffect(() => {
    if (!pauseWhenHidden) return;
    const provider = providerRef.current;
    if (!provider) return;
    if (!pageVisible) {
      logDebug("patch-workbook", "Page hidden — disconnecting Yjs WebSocket");
      provider.disconnect();
      setConn("connecting");
    } else {
      logDebug("patch-workbook", "Page visible — reconnecting Yjs WebSocket");
      provider.connect();
    }
  }, [pauseWhenHidden, pageVisible]);

  usePatchWorkbookOpLogEffects(
    roomId,
    yops,
    wbRef,
    synced,
    workbookReady,
    suppressYjsOpsForFormulaRecalcRef,
    onHydrationChange,
  );

  return { wbRef, onOp, conn, synced, workbookHydrated };
}
