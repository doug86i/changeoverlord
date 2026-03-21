import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Sheet } from "@fortune-sheet/core";
import { Workbook } from "@fortune-sheet/react";
import { apiGet } from "../api/client";
import type { PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { PatchWorkbookErrorBoundary } from "../components/PatchWorkbookErrorBoundary";
import { PerformanceBandNav } from "../components/PerformanceBandNav";
import { PatchPageSidebar } from "../components/PatchPageSidebar";
import {
  sheetsFromApiSeed,
  usePatchWorkbookCollab,
} from "../lib/patchWorkbookCollab";

const PATCH_SIDEBAR_COLLAPSED_KEY = "patch-sidebar-collapsed";

export function PatchPage() {
  const { performanceId } = useParams<{ performanceId: string }>();
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
      apiGet<{ performance: PerformanceRow; initialSheets: Sheet[] }>(
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

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const initialSheets = useMemo(
    () => sheetsFromApiSeed(perfQ.data?.initialSheets),
    [performanceId, perfQ.data?.initialSheets],
  );

  const workbookReady = Boolean(
    performanceId &&
      perfQ.isSuccess &&
      perfQ.data &&
      initialSheets !== null,
  );

  const { wbRef, onOp, conn, synced } = usePatchWorkbookCollab({
    roomId: performanceId,
    mode: "performance",
    workbookReady,
    onLocalOp: markDirty,
  });

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

  if (!performanceId) return null;
  if (perfQ.isLoading) return <p className="muted">Loading…</p>;
  if (perfQ.error || !perfQ.data) {
    return <p role="alert">Performance not found.</p>;
  }

  if (initialSheets === null) {
    return (
      <div>
        <p className="muted" style={{ marginTop: 0 }}>
          <Link to="/settings">Settings</Link>
          {" · "}
          Patch workbook
        </p>
        <p role="alert">
          This performance has no patch workbook data (it was created before a default template
          was chosen, or the stage had no template). Choose a{" "}
          <strong>default patch template</strong> on the stage, then add new performances — or
          duplicate this slot after assigning a template.
        </p>
      </div>
    );
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
      {showPatchSidebar && day && stageDayId && (
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
