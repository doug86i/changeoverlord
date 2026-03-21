import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";
import type { FileAssetPurpose, FileAssetRow, PerformanceRow } from "../api/types";
import { formatClockHeroCountdown } from "../lib/dateFormat";
import {
  computeStageDayClockMetrics,
  sortPerformancesByStart,
} from "../lib/stageDayClockMetrics";

type TimeRes = { iso: string; unixMs: number };

function isPlotAsset(f: FileAssetRow): boolean {
  if (f.purpose !== "plot_pdf") return false;
  return f.mimeType === "application/pdf" || f.mimeType.startsWith("image/");
}

function pickPlotPreview(perfFiles: FileAssetRow[], stageFiles: FileAssetRow[]): FileAssetRow | null {
  const p = perfFiles.find(isPlotAsset);
  if (p) return p;
  return stageFiles.find(isPlotAsset) ?? null;
}

function firstFileByPurpose(
  files: FileAssetRow[],
  purpose: FileAssetPurpose,
): FileAssetRow | null {
  return files.find((f) => f.purpose === purpose) ?? null;
}

function PerfPatchLink({ perf }: { perf: PerformanceRow }) {
  return (
    <Link to={`/patch/${perf.id}`} className="patch-sidebar-perf-link">
      {perf.bandName || "—"}
    </Link>
  );
}

export function PatchPageSidebar({
  performanceId,
  stageDayId,
  dayDate,
  stageId,
  currentPerformance,
  collapsed,
  onCollapsedChange,
}: {
  performanceId: string;
  stageDayId: string;
  dayDate: string;
  stageId: string;
  currentPerformance: {
    bandName: string;
    startTime: string;
    endTime: string | null;
  };
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const perfQ = useQuery({
    queryKey: ["performances", stageDayId],
    queryFn: () =>
      apiGet<{ performances: PerformanceRow[] }>(
        `/api/v1/stage-days/${stageDayId}/performances`,
      ),
    enabled: Boolean(stageDayId),
  });

  const timeQ = useQuery({
    queryKey: ["serverTime"],
    queryFn: () => apiGet<TimeRes>("/api/v1/time"),
    refetchInterval: 30_000,
  });

  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    if (timeQ.data) setOffsetMs(timeQ.data.unixMs - Date.now());
  }, [timeQ.data]);

  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(tick + offsetMs), [tick, offsetMs]);

  const sorted = useMemo(
    () => sortPerformancesByStart(perfQ.data?.performances ?? []),
    [perfQ.data],
  );

  const { currentIdx, nextIdx, heroSeconds, heroLabel, isChangeover } = useMemo(
    () => computeStageDayClockMetrics(dayDate, sorted, now),
    [dayDate, sorted, now],
  );

  const countdownText =
    heroSeconds !== null && heroLabel
      ? formatClockHeroCountdown(heroLabel, heroSeconds)
      : "—";

  const wallTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const onStage = currentIdx >= 0 ? sorted[currentIdx] : null;
  const nextAct = nextIdx >= 0 ? sorted[nextIdx] : null;

  const perfFilesQ = useQuery({
    queryKey: ["files", "performance", performanceId],
    queryFn: () =>
      apiGet<{ files: FileAssetRow[] }>(`/api/v1/files?performanceId=${performanceId}`),
    enabled: Boolean(performanceId),
  });

  const stageFilesQ = useQuery({
    queryKey: ["files", stageId],
    queryFn: () =>
      apiGet<{ files: FileAssetRow[] }>(`/api/v1/files?stageId=${stageId}`),
    enabled: Boolean(stageId),
  });

  const plotFile = useMemo(() => {
    const pf = perfFilesQ.data?.files ?? [];
    const sf = stageFilesQ.data?.files ?? [];
    return pickPlotPreview(pf, sf);
  }, [perfFilesQ.data, stageFilesQ.data]);

  const riderFile = useMemo(() => {
    const pf = perfFilesQ.data?.files ?? [];
    const sf = stageFilesQ.data?.files ?? [];
    return firstFileByPurpose(pf, "rider_pdf") ?? firstFileByPurpose(sf, "rider_pdf");
  }, [perfFilesQ.data, stageFilesQ.data]);

  const urgencyClass =
    heroSeconds === null
      ? ""
      : heroSeconds <= 60
        ? "status-danger"
        : heroSeconds <= 300
          ? "status-warn"
          : "status-ok";

  if (collapsed) {
    return (
      <div className="patch-sidebar patch-sidebar--collapsed-rail">
        <button
          type="button"
          className="patch-sidebar-expand-btn"
          onClick={() => onCollapsedChange(false)}
          aria-expanded="false"
          title="Show sidebar — clock, schedule, plots, links"
        >
          <span aria-hidden className="patch-sidebar-expand-icon">
            «
          </span>
          <span className="patch-sidebar-expand-label">Context</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="patch-sidebar" aria-label="Patch context">
      <div className="patch-sidebar-header">
        <span className="patch-sidebar-header-title">Session context</span>
        <button
          type="button"
          className="patch-sidebar-collapse-btn icon-btn"
          onClick={() => onCollapsedChange(true)}
          aria-expanded="true"
          title="Hide sidebar for a larger spreadsheet"
        >
          Hide »
        </button>
      </div>

      {isChangeover ? (
        <div className="patch-sidebar-badge" role="status">
          Changeover
        </div>
      ) : null}

      <div className="patch-sidebar-block">
        <div className="patch-sidebar-label">Local time</div>
        <div className="patch-sidebar-wall" title="Server-synced time">
          {wallTime}
        </div>
      </div>

      <div className="patch-sidebar-block">
        <div className="patch-sidebar-label">Now</div>
        {onStage ? (
          <div className="patch-sidebar-slot">
            <PerfPatchLink perf={onStage} />
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              {onStage.startTime}
              {onStage.endTime ? ` – ${onStage.endTime}` : ""}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            —
          </p>
        )}
      </div>

      <div className="patch-sidebar-block">
        <div className="patch-sidebar-label">Countdown</div>
        <div className={`patch-sidebar-countdown ${urgencyClass}`} title={heroLabel || undefined}>
          {countdownText}
        </div>
        {heroLabel ? <div className="patch-sidebar-sublabel muted">{heroLabel}</div> : null}
      </div>

      <div className="patch-sidebar-block">
        <div className="patch-sidebar-label">Next</div>
        {nextAct ? (
          <div className="patch-sidebar-slot">
            <PerfPatchLink perf={nextAct} />
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Starts {nextAct.startTime}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            —
          </p>
        )}
      </div>

      <div className="patch-sidebar-block patch-sidebar-block--this-act">
        <div className="patch-sidebar-label">This spreadsheet (your act)</div>
        <div className="patch-sidebar-slot">
          <strong>{currentPerformance.bandName || "—"}</strong>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            {currentPerformance.startTime}
            {currentPerformance.endTime ? ` – ${currentPerformance.endTime}` : ""}
          </div>
        </div>
        <p className="patch-sidebar-hint muted">
          <kbd className="patch-kbd">Alt</kbd>
          <kbd className="patch-kbd">←</kbd>
          <kbd className="patch-kbd">→</kbd>
        </p>
      </div>

      <div className="patch-sidebar-block">
        <div className="patch-sidebar-label">Quick links</div>
        <ul className="patch-sidebar-links">
          <li>
            <Link to={`/performances/${performanceId}/files`}>All files</Link>
          </li>
          {riderFile ? (
            <li>
              <a
                href={`/api/v1/files/${riderFile.id}/raw`}
                target="_blank"
                rel="noreferrer"
              >
                Rider PDF
              </a>
            </li>
          ) : null}
          <li>
            <Link to={`/clock/day/${stageDayId}`}>Stage clock</Link>
          </li>
          <li>
            <Link to={`/stage-days/${stageDayId}`}>Running order</Link>
          </li>
        </ul>
      </div>
      <div className="patch-sidebar-block patch-sidebar-block--plot">
        <div className="patch-sidebar-label">Stage plot</div>
        {plotFile ? (
          <>
            <p className="muted" style={{ fontSize: "0.75rem", margin: "0 0 0.35rem" }}>
              {plotFile.originalName}
              <span className="muted"> · {plotFile.purpose.replace(/_/g, " ")}</span>
            </p>
            {plotFile.mimeType === "application/pdf" ? (
              <div className="patch-sidebar-plot-frame">
                <iframe
                  title="Stage plot preview"
                  src={`/api/v1/files/${plotFile.id}/raw`}
                />
              </div>
            ) : (
              <div className="patch-sidebar-plot-frame patch-sidebar-plot-frame--img">
                <img src={`/api/v1/files/${plotFile.id}/raw`} alt="" />
              </div>
            )}
            <a
              href={`/api/v1/files/${plotFile.id}/raw`}
              target="_blank"
              rel="noreferrer"
              className="icon-btn"
              style={{ marginTop: "0.35rem", display: "inline-block" }}
            >
              Open full size
            </a>
          </>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            No stage plot.{" "}
            <Link to={`/performances/${performanceId}/files`}>Files</Link>
            {" — "}
            <span className="muted">Upload as “Stage plot”</span>
          </p>
        )}
      </div>
    </aside>
  );
}
