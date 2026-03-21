import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type { Transaction, YArrayEvent } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import type { Op, Sheet } from "@fortune-sheet/core";
import { apiGet } from "../api/client";
import type { PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { logDebug } from "../lib/debug";
import { PatchWorkbookErrorBoundary } from "../components/PatchWorkbookErrorBoundary";
import { PerformanceBandNav } from "../components/PerformanceBandNav";
import { PatchPageSidebar } from "../components/PatchPageSidebar";

const ORIGIN = "fortune-local";

const PATCH_SIDEBAR_COLLAPSED_KEY = "patch-sidebar-collapsed";

function createEmptyPatchSheets(): Sheet[] {
  return [
    {
      id: "patch-sheet-input",
      name: "Input",
      status: 1,
      row: 36,
      column: 18,
      order: 0,
    },
    {
      id: "patch-sheet-rf",
      name: "RF",
      status: 0,
      row: 36,
      column: 18,
      order: 1,
    },
  ];
}

export function PatchPage() {
  const { performanceId } = useParams<{ performanceId: string }>();
  const wbRef = useRef<WorkbookInstance>(null);
  const [conn, setConn] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [synced, setSynced] = useState(false);
  const dirtyRef = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(PATCH_SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PATCH_SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const perfQ = useQuery({
    queryKey: ["performance", performanceId],
    queryFn: () =>
      apiGet<{ performance: PerformanceRow }>(
        `/api/v1/performances/${performanceId}`,
      ),
    enabled: Boolean(performanceId),
  });

  const stageDayId = perfQ.data?.performance.stageDayId;

  const dayQ = useQuery({
    queryKey: ["stageDay", stageDayId],
    queryFn: () =>
      apiGet<{ stageDay: StageDayRow }>(`/api/v1/stage-days/${stageDayId}`),
    enabled: Boolean(stageDayId),
  });

  const stageId = dayQ.data?.stageDay.stageId;

  const stageQ = useQuery({
    queryKey: ["stage", stageId],
    queryFn: () => apiGet<{ stage: StageRow }>(`/api/v1/stages/${stageId}`),
    enabled: Boolean(stageId),
  });

  const ydoc = useMemo(() => new Y.Doc(), [performanceId]);
  const yops = useMemo(() => ydoc.getArray<string>("opLog"), [ydoc]);

  const initialSheets = useMemo(
    () => createEmptyPatchSheets(),
    [performanceId],
  );

  const onOp = useCallback(
    (ops: Op[]) => {
      dirtyRef.current = true;
      ydoc.transact(() => {
        yops.push([JSON.stringify(ops)]);
      }, ORIGIN);
    },
    [ydoc, yops],
  );

  // beforeunload warning when workbook has unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (conn !== "connected" && dirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [conn]);

  useEffect(() => {
    if (!performanceId) return;

    logDebug("patch-workbook", "PatchPage Yjs provider starting", {
      performanceId,
    });

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const base = `${proto}//${window.location.host}/ws/v1/collab`;
    const provider = new WebsocketProvider(base, performanceId, ydoc, {
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
  }, [performanceId, ydoc]);

  useEffect(() => {
    const handler = (event: YArrayEvent<string>, transaction: Transaction) => {
      if (transaction.origin === ORIGIN) return;
      for (const d of event.changes.delta) {
        if (d.insert === undefined) continue;
        const inserts = Array.isArray(d.insert) ? d.insert : [d.insert];
        for (const item of inserts) {
          if (typeof item !== "string") continue;
          try {
            const ops = JSON.parse(item) as Op[];
            wbRef.current?.applyOp(ops);
          } catch {
            /* ignore bad remote payload */
          }
        }
      }
    };
    yops.observe(handler);
    return () => {
      yops.unobserve(handler);
    };
  }, [yops]);

  if (!performanceId) return null;
  if (perfQ.isLoading) return <p className="muted">Loading…</p>;
  if (perfQ.error || !perfQ.data) {
    return <p role="alert">Performance not found.</p>;
  }

  const perf = perfQ.data.performance;
  const day = dayQ.data?.stageDay;
  const stage = stageQ.data?.stage;

  const connLabel = conn === "error"
    ? "Connection error"
    : !synced
      ? "Syncing…"
      : "Live";

  const connClass = conn === "error"
    ? "status-danger"
    : !synced
      ? "status-warn"
      : "status-ok";

  const showPatchSidebar = Boolean(
    performanceId && stageDayId && day?.dayDate && day.stageId,
  );

  const layoutClass = showPatchSidebar
    ? `patch-page-layout${sidebarCollapsed ? " patch-page-layout--sidebar-collapsed" : ""}`
    : undefined;

  return (
    <div className={layoutClass}>
      {showPatchSidebar && day && (
        <PatchPageSidebar
          performanceId={performanceId}
          stageDayId={stageDayId}
          dayDate={day.dayDate}
          stageId={day.stageId}
          currentPerformance={{
            bandName: perf.bandName,
            startTime: perf.startTime,
            endTime: perf.endTime,
          }}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      )}
      <div className={showPatchSidebar ? "patch-page-main" : undefined}>
      <p className="muted" style={{ marginTop: 0 }}>
        {stage && day && (
          <>
            <Link to={`/events/${stage.eventId}`}>Event</Link>
            {" / "}
            <Link to={`/stages/${stage.id}`}>{stage.name}</Link>
            {" / "}
            <Link to={`/stage-days/${day.id}`}>{day.dayDate}</Link>
            {" / "}
          </>
        )}
        <span>{perf.bandName || "Performance"}</span>
        {" · "}
        <Link to={`/performances/${perf.id}/files`}>Files</Link>
      </p>

      {stageDayId && (
        <PerformanceBandNav
          performanceId={performanceId}
          stageDayId={stageDayId}
          mode="patch"
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Patch &amp; RF — {perf.bandName}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span className={`${connClass}`} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            ● {connLabel}
          </span>
        </div>
      </div>
      <div
        className="patch-workbook-host"
        style={{
          height: "min(70vh, 720px)",
          minHeight: 360,
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        <PatchWorkbookErrorBoundary key={performanceId}>
          <Workbook
            key={performanceId}
            ref={wbRef}
            data={initialSheets}
            onOp={onOp}
            showToolbar
            showFormulaBar
            showSheetTabs
          />
        </PatchWorkbookErrorBoundary>
      </div>
      </div>
    </div>
  );
}
