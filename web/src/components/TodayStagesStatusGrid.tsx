import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { apiGet } from "../api/client";
import type { PerformanceRow } from "../api/types";
import { ClockArena } from "./ClockArena";
import type { StageDayWithContext } from "../hooks/useAllStagesClockBundle";
import {
  computeStageDayClockMetrics,
  sortPerformancesByStart,
} from "../lib/stageDayClockMetrics";
import { formatDateShort } from "../lib/dateFormat";
import {
  buildClockArenaActPresentation,
  urgencyFromSeconds,
} from "../lib/clockArenaHelpers";

function StageTodayCard({
  item,
  performances,
  now,
}: {
  item: StageDayWithContext;
  performances: PerformanceRow[] | undefined;
  now: Date;
}) {
  const sorted = sortPerformancesByStart(performances ?? []);
  const m = computeStageDayClockMetrics(item.day.dayDate, sorted, now);
  const actPresentation = useMemo(
    () => buildClockArenaActPresentation(sorted, m.currentIdx, m.nextIdx),
    [sorted, m.currentIdx, m.nextIdx],
  );
  const heroUrgency = urgencyFromSeconds(m.heroSeconds);
  const wallTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const arenaProps = {
    urgentMessage: null as string | null,
    dayLabel: formatDateShort(item.day.dayDate),
    stageName: item.stage.name,
    sorted,
    currentIdx: m.currentIdx,
    nextIdx: m.nextIdx,
    clockBanner: m.clockBanner,
    actPresentation,
    heroLabel: m.heroLabel,
    heroSeconds: m.heroSeconds,
    wallTime,
    heroUrgency,
    footerActions: (
      <Link to={`/clock/day/${item.day.id}`} className="primary">
        Open stage clock
      </Link>
    ),
  };

  return (
    <li className="card dashboard-stage-today-card" style={{ margin: 0 }}>
      <div className="title-bar" style={{ marginBottom: "0.5rem" }}>
        <span style={{ fontWeight: 700 }}>{item.stage.name}</span>
        <span className="muted" style={{ marginLeft: "0.35rem", fontWeight: 400 }}>
          {item.event.name}
        </span>
      </div>

      <div className="dashboard-mini-arena-wrap">
        <ClockArena mode="contained" {...arenaProps} />
      </div>

      {sorted.length > 0 ? (
        <details className="dashboard-running-order-details" style={{ marginTop: "0.75rem" }}>
          <summary className="dashboard-running-order-summary">
            Running order ({sorted.length} act{sorted.length === 1 ? "" : "s"})
          </summary>
          <ul
            className="dashboard-running-order-list"
            style={{
              listStyle: "none",
              padding: "0.5rem 0 0",
              margin: 0,
              fontSize: "0.9rem",
            }}
          >
            {sorted.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: "0.35rem 0.75rem",
                  marginBottom: "0.35rem",
                }}
              >
                <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {p.startTime}
                  {p.endTime ? `–${p.endTime}` : "–…"}
                </span>
                <strong>{p.bandName || "—"}</strong>
                <Link to={`/patch/${p.id}`} className="icon-btn" style={{ fontSize: "0.75rem" }}>
                  Patch
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
          <Link to={`/stage-days/${item.day.id}`}>Edit running order</Link>
        </p>
      )}
    </li>
  );
}

/**
 * Mini {@link ClockArena} per stage-day (same layout as full stage clock), plus expandable running order.
 */
export function TodayStagesStatusGrid({
  items,
  now,
}: {
  items: StageDayWithContext[];
  now: Date;
}) {
  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["performances", item.day.id],
      queryFn: () =>
        apiGet<{ performances: PerformanceRow[] }>(
          `/api/v1/stage-days/${item.day.id}/performances`,
        ),
      staleTime: 10_000,
    })),
  });

  if (items.length === 0) {
    return (
      <div className="empty-state card">
        <p className="muted" style={{ margin: 0 }}>
          No stage days match today&apos;s date on the calendar.
        </p>
      </div>
    );
  }

  return (
    <ul
      className="today-stages-status-grid"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
        gap: "1rem",
      }}
    >
      {items.map((item, i) => (
        <StageTodayCard
          key={item.day.id}
          item={item}
          performances={queries[i]?.data?.performances}
          now={now}
        />
      ))}
    </ul>
  );
}
