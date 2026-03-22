import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Workbook } from "@fortune-sheet/react";
import { apiGet, apiSend, downloadWorkbookJson, readFileAsText } from "../api/client";
import type { PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { PatchWorkbookErrorBoundary } from "../components/PatchWorkbookErrorBoundary";
import { PerformanceBandNav } from "../components/PerformanceBandNav";
import { PatchPageSidebar } from "../components/PatchPageSidebar";
import {
  WORKBOOK_PLACEHOLDER,
  usePatchWorkbookCollab,
} from "../lib/patchWorkbookCollab";

const PATCH_SIDEBAR_COLLAPSED_KEY = "patch-sidebar-collapsed";

export function PatchPage() {
  const { performanceId } = useParams<{ performanceId: string }>();
  const dirtyRef = useRef(false);
  const perfJsonImportRef = useRef<HTMLInputElement>(null);
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

  const importPerfWorkbookJson = useMutation({
    mutationFn: async (text: string) => {
      const id = performanceId;
      if (!id) throw new Error("Missing performance");
      const body = JSON.parse(text) as unknown;
      return apiSend(`/api/v1/performances/${id}/sheets-import`, "PUT", body);
    },
    onSuccess: () => {
      window.location.reload();
    },
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

  const workbookReady = Boolean(performanceId && perfQ.isSuccess && perfQ.data);

  const { wbRef, onOp, conn, synced, workbookHydrated } = usePatchWorkbookCollab({
    roomId: performanceId,
    mode: "performance",
    workbookReady,
    onLocalOp: markDirty,
  });

  const blockingWorkbook =
    workbookReady && !workbookHydrated && conn !== "error";

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

  const perf = perfQ.data.performance;
  const day = dayQ.data?.stageDay;
  const stage = stageQ.data?.stage;

  const connLabel = conn === "error"
    ? "Connection error"
    : !synced
      ? "Syncing…"
      : !workbookHydrated
        ? "Loading workbook…"
        : "Live";

  const connClass = conn === "error"
    ? "status-danger"
    : !synced || !workbookHydrated
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="icon-btn"
            disabled={importPerfWorkbookJson.isPending}
            onClick={async () => {
              try {
                await downloadWorkbookJson(
                  `/api/v1/performances/${performanceId}/sheets-export`,
                  `${perf.bandName || "performance"}_workbook.json`,
                );
              } catch (err) {
                window.alert((err as Error).message);
              }
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={importPerfWorkbookJson.isPending}
            onClick={() => perfJsonImportRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={perfJsonImportRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const text = await readFileAsText(f);
                importPerfWorkbookJson.mutate(text);
              } catch (err) {
                window.alert((err as Error).message);
              }
            }}
          />
          <span className={`${connClass}`} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            ● {connLabel}
          </span>
        </div>
      </div>
      {importPerfWorkbookJson.isError && (
        <p role="alert" style={{ color: "var(--color-brand)", marginTop: 0 }}>
          {(importPerfWorkbookJson.error as Error).message}
        </p>
      )}
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
        {blockingWorkbook ? (
          <div
            className="patch-workbook-host__loading"
            aria-busy="true"
            aria-live="polite"
          >
            Loading workbook…
          </div>
        ) : null}
        <PatchWorkbookErrorBoundary key={performanceId}>
          <Workbook
            key={performanceId}
            ref={wbRef}
            data={WORKBOOK_PLACEHOLDER}
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
