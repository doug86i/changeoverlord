import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { apiGet } from "../api/client";
import type { FileAssetPurpose, FileAssetRow, PerformanceRow } from "../api/types";
import { formatClockHeroCountdown } from "../lib/dateFormat";
import {
  computeStageDayClockMetrics,
  sortPerformancesByStart,
} from "../lib/stageDayClockMetrics";
import { useServerTime } from "../hooks/useServerTime";
import { PatchQrLink } from "./PatchQrCode";

function isPlotAsset(f: FileAssetRow): boolean {
  if (f.purpose !== "plot_pdf") return false;
  return f.mimeType === "application/pdf" || f.mimeType.startsWith("image/");
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
  variant = "default",
  onRequestClose,
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
  /** Phone patch menu: always expanded panel with Close instead of collapse rail. */
  variant?: "default" | "phoneMenu";
  onRequestClose?: () => void;
}) {
  const perfQ = useQuery({
    queryKey: ["performances", stageDayId],
    queryFn: () =>
      apiGet<{ performances: PerformanceRow[] }>(
        `/api/v1/stage-days/${stageDayId}/performances`,
      ),
    enabled: Boolean(stageDayId),
  });

  const { now } = useServerTime({
    tickIntervalMs: 250,
    refetchIntervalMs: 30_000,
  });

  const sorted = useMemo(
    () => sortPerformancesByStart(perfQ.data?.performances ?? []),
    [perfQ.data],
  );

  const { currentIdx, nextIdx, heroSeconds, heroLabel, clockBanner } = useMemo(
    () => computeStageDayClockMetrics(dayDate, sorted, now),
    [dayDate, sorted, now],
  );

  const sidebarHandoverBadge =
    clockBanner === "between_acts"
      ? "Changeover"
      : clockBanner === "pre_show"
        ? "Before show"
        : clockBanner === "on_stage_next"
          ? "Next act in"
          : null;

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

  /** Only this act’s files — same rule as stage plot (no stage-wide fallback; avoids another band’s rider). */
  const plotFile = useMemo(() => {
    const pf = perfFilesQ.data?.files ?? [];
    return pf.find(isPlotAsset) ?? null;
  }, [perfFilesQ.data]);

  const riderFile = useMemo(() => {
    const pf = perfFilesQ.data?.files ?? [];
    return firstFileByPurpose(pf, "rider_pdf");
  }, [perfFilesQ.data]);

  const urgencyClass =
    heroSeconds === null
      ? ""
      : heroSeconds <= 60
        ? "status-danger"
        : heroSeconds <= 300
          ? "status-warn"
          : "status-ok";

  if (variant !== "phoneMenu" && collapsed) {
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
    <aside
      className={`patch-sidebar${variant === "phoneMenu" ? " patch-sidebar--phone-menu" : ""}`}
      aria-label="Patch context"
    >
      <div className="patch-sidebar-header">
        <span className="patch-sidebar-header-title">Session context</span>
        {variant === "phoneMenu" ? (
          <button
            type="button"
            className="patch-sidebar-collapse-btn icon-btn"
            onClick={() => onRequestClose?.()}
            aria-expanded="true"
            title="Close menu"
          >
            Close
          </button>
        ) : (
          <button
            type="button"
            className="patch-sidebar-collapse-btn icon-btn"
            onClick={() => onCollapsedChange(true)}
            aria-expanded="true"
            title="Hide sidebar for a larger spreadsheet"
          >
            Hide »
          </button>
        )}
      </div>

      {sidebarHandoverBadge ? (
        <div className="patch-sidebar-badge" role="status">
          {sidebarHandoverBadge}
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
        <div className="patch-sidebar-qr">
          <PatchQrLink
            performanceId={performanceId}
            size={104}
            title="Scan to open this patch on your phone (same URL as Patch / RF)"
          />
        </div>
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
            No plot for this act. Open{" "}
            <Link to={`/performances/${performanceId}/files`}>Files</Link>
            {" "}
            and mark a file as <strong>Stage plot</strong>, or use{" "}
            <Link to={`/stages/${stageId}`}>Stage → Stage files</Link> for a plot
            shared by the whole stage (not shown here).
          </p>
        )}
      </div>
    </aside>
  );
}
