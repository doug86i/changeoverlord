import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Workbook } from "@fortune-sheet/react";
import { apiGet, apiSend, downloadWorkbookJson, readFileAsText } from "../api/client";
import type { PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { PatchWorkbookErrorBoundary } from "../components/PatchWorkbookErrorBoundary";
import { PerformanceBandNav } from "../components/PerformanceBandNav";
import { PatchPageSidebar } from "../components/PatchPageSidebar";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { formatDateShort } from "../lib/dateFormat";
import { PHONE_MAX_MEDIA } from "../lib/breakpoints";
import { usePatchWorkbookCollab } from "../lib/patchWorkbookCollab";

const PATCH_SIDEBAR_COLLAPSED_KEY = "patch-sidebar-collapsed";

export function PatchPage() {
  const { performanceId } = useParams<{ performanceId: string }>();
  const dirtyRef = useRef(false);
  const perfJsonImportRef = useRef<HTMLInputElement>(null);
  /** Phone patch host: block synthetic `wheel` so touch pan is not doubled with FortuneSheet `handleGlobalWheel`. */
  const patchWorkbookHostRef = useRef<HTMLDivElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const isPhone = useMediaQuery(PHONE_MAX_MEDIA);

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

  useEffect(() => {
    if (!isPhone || !phoneMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhoneMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPhone, phoneMenuOpen]);

  /** Phone: React Router keeps document scroll from the previous route; reset so the patch layout isn't offset. */
  useLayoutEffect(() => {
    if (!isPhone || !performanceId) return;
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
      document.getElementById("main-content")?.scrollTo(0, 0);
    };
    resetScroll();
    const raf = requestAnimationFrame(() => {
      resetScroll();
    });
    return () => cancelAnimationFrame(raf);
  }, [isPhone, performanceId]);

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

  const { wbRef, onOp, conn, workbookSheets, workbookHydrated, workbookDataRev } =
    usePatchWorkbookCollab({
    roomId: performanceId,
    mode: "performance",
    workbookReady,
    onLocalOp: markDirty,
    pauseWhenHidden: isPhone,
    readOnly: isPhone,
  });

  const blockingWorkbook =
    workbookReady &&
    (workbookSheets == null || !workbookHydrated) &&
    conn !== "error";

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isPhone) return;
      if (conn !== "connected" && dirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [conn, isPhone]);

  useEffect(() => {
    if (!isPhone || !workbookReady) return;
    const host = patchWorkbookHostRef.current;
    if (!host) return;
    const opts: AddEventListenerOptions = { capture: true, passive: false };
    const onWheelCapture = (e: WheelEvent) => {
      // iOS (and some browsers) emit `wheel` during touch pan. FortuneSheet's
      // handleGlobalWheel moves by fixed row steps and toggles scroll locks,
      // which fights overlay touch scrolling and can lock vertical direction.
      e.preventDefault();
      e.stopPropagation();
    };
    host.addEventListener("wheel", onWheelCapture, opts);
    return () => host.removeEventListener("wheel", onWheelCapture, opts);
  }, [isPhone, workbookReady]);

  if (!performanceId) return null;
  if (perfQ.isLoading) return <p className="muted">Loading…</p>;
  if (perfQ.error || !perfQ.data) {
    return <p role="alert">Performance not found.</p>;
  }

  const perf = perfQ.data.performance;
  const day = dayQ.data?.stageDay;
  const stage = stageQ.data?.stage;

  const connLabel =
    conn === "error"
      ? "Connection error"
      : workbookSheets == null || !workbookHydrated
        ? "Loading workbook…"
        : "Live";

  const connClass =
    conn === "error"
      ? "status-danger"
      : workbookSheets == null || !workbookHydrated
        ? "status-warn"
        : "status-ok";

  const showPatchSidebar = Boolean(
    performanceId && stageDayId && day?.dayDate && day.stageId,
  );

  const layoutClass = showPatchSidebar
    ? `patch-page-layout${sidebarCollapsed ? " patch-page-layout--sidebar-collapsed" : ""}`
    : undefined;

  const sidebarProps =
    showPatchSidebar && day && stageDayId
      ? {
          performanceId,
          stageDayId,
          dayDate: day.dayDate,
          stageId: day.stageId,
          currentPerformance: {
            bandName: perf.bandName,
            startTime: perf.startTime,
            endTime: perf.endTime,
          },
          collapsed: sidebarCollapsed,
          onCollapsedChange: setSidebarCollapsed,
        }
      : null;

  const breadcrumbs = stage && day && (
    <p className="muted patch-page-breadcrumbs" style={{ marginTop: 0 }}>
      <Link to={`/events/${stage.eventId}`}>Event</Link>
      {" / "}
      <Link to={`/stages/${stage.id}`}>{stage.name}</Link>
      {" / "}
      <Link to={`/stage-days/${day.id}`}>{formatDateShort(day.dayDate)}</Link>
      {" / "}
      <span>{perf.bandName || "Performance"}</span>
      {" · "}
      <Link to={`/performances/${perf.id}/files`}>Files</Link>
    </p>
  );

  const collabSaveBanner =
    workbookHydrated &&
    workbookSheets != null &&
    conn !== "connected" ? (
      <p className="patch-collab-banner status-warn" role="status">
        Edits may not save — reconnecting…
      </p>
    ) : null;

  const workbookKey = `${performanceId}-${workbookDataRev}`;

  const workbookInner = (
    <>
      {collabSaveBanner}
      {blockingWorkbook ? (
        <div
          className="patch-workbook-host__loading"
          aria-busy="true"
          aria-live="polite"
        >
          Loading workbook…
        </div>
      ) : null}
      {workbookSheets != null && workbookHydrated ? (
        <PatchWorkbookErrorBoundary
          key={workbookKey}
          roomId={performanceId}
          collabDebug={{
            conn,
            workbookHydrated,
          }}
        >
          <Workbook
            key={workbookKey}
            ref={wbRef}
            data={workbookSheets}
            onOp={onOp}
            allowEdit={!isPhone}
            showToolbar={!isPhone}
            showFormulaBar={!isPhone}
            showSheetTabs
          />
        </PatchWorkbookErrorBoundary>
      ) : null}
    </>
  );

  const rootClass = isPhone
    ? "patch-page patch-page--phone"
    : layoutClass;

  return (
    <div className={rootClass}>
      {/* Desktop/tablet sidebar (child 0) */}
      {!isPhone && showPatchSidebar && sidebarProps ? (
        <PatchPageSidebar {...sidebarProps} />
      ) : null}

      {/* Content column (child 1 — always present, keeps workbook stable) */}
      <div className={isPhone ? "patch-page-phone-content" : showPatchSidebar ? "patch-page-main" : undefined}>
        {/* Phone top bar (child 0 inside content) */}
        {isPhone ? (
          <div className="patch-page-phone-bar">
            <span className="patch-page-phone-band">{perf.bandName || "Patch"}</span>
            <button
              type="button"
              className="icon-btn patch-page-phone-menu-btn"
              aria-expanded={phoneMenuOpen}
              aria-controls="patch-phone-menu"
              onClick={() => setPhoneMenuOpen((o) => !o)}
            >
              Menu
            </button>
          </div>
        ) : null}

        {/* Phone menu panel — position:fixed, doesn't affect flow (child 1) */}
        {isPhone && phoneMenuOpen ? (
          <div className="patch-phone-menu-wrapper">
            <button
              type="button"
              className="patch-phone-menu-backdrop"
              aria-label="Close menu"
              onClick={() => setPhoneMenuOpen(false)}
            />
            <div
              id="patch-phone-menu"
              className="patch-phone-menu-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="patch-phone-menu-title"
            >
              <h2 id="patch-phone-menu-title" className="visually-hidden">
                Patch navigation and context
              </h2>
              <div className="patch-phone-menu-scroll">
                {breadcrumbs}
                {stageDayId ? (
                  <PerformanceBandNav
                    performanceId={performanceId}
                    stageDayId={stageDayId}
                    mode="patch"
                  />
                ) : null}
                <p className={connClass} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  ● {connLabel}
                </p>
                {sidebarProps ? (
                  <PatchPageSidebar
                    {...sidebarProps}
                    variant="phoneMenu"
                    onRequestClose={() => setPhoneMenuOpen(false)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Desktop/tablet header (child 2) */}
        {!isPhone ? (
          <>
            {breadcrumbs}

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
                <span className={connClass} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  ● {connLabel}
                </span>
              </div>
            </div>
            {importPerfWorkbookJson.isError && (
              <p role="alert" style={{ color: "var(--color-danger)", marginTop: 0 }}>
                {(importPerfWorkbookJson.error as Error).message}
              </p>
            )}
          </>
        ) : null}

        {/* Workbook — always at child 3; survives phone↔desktop transitions */}
        <div
          ref={patchWorkbookHostRef}
          className={
            `patch-workbook-host${isPhone ? " patch-workbook-host--readonly patch-workbook-host--phone" : ""}`
          }
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            ...(isPhone ? {} : { height: "min(70vh, 720px)", minHeight: 360 }),
          }}
        >
          {workbookInner}
        </div>
      </div>
    </div>
  );
}
