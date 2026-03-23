import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
import type { PerformanceRow } from "../api/types";
import type { StageDayWithContext } from "../hooks/useAllStagesClockBundle";
import {
  computeStageDayClockMetrics,
  sortPerformancesByStart,
} from "../lib/stageDayClockMetrics";
import { formatCountdownOrDays, formatDateShort } from "../lib/dateFormat";

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
  const cur = m.currentIdx >= 0 ? sorted[m.currentIdx] : null;
  const nxt = m.nextIdx >= 0 ? sorted[m.nextIdx] : null;

  return (
    <li className="card today-stage-card" style={{ margin: 0 }}>
      <div className="title-bar" style={{ marginBottom: "0.35rem" }}>
        <Link to={`/clock/day/${item.day.id}`} style={{ fontWeight: 700 }}>
          {item.stage.name}
        </Link>
        <span className="muted" style={{ marginLeft: "0.35rem", fontWeight: 400 }}>
          {item.event.name}
        </span>
      </div>
      <p style={{ margin: "0 0 0.25rem", fontSize: "0.9rem" }} className="muted">
        {formatDateShort(item.day.dayDate)}
      </p>
      {sorted.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No performances scheduled.
        </p>
      ) : (
        <>
          <p style={{ margin: "0.0rem 0 0.25rem" }}>
            <span className="muted">Now: </span>
            <strong>{cur?.bandName || "—"}</strong>
            {cur?.startTime ? (
              <span className="muted" style={{ marginLeft: "0.35rem" }}>
                {cur.startTime}
                {cur.endTime ? `–${cur.endTime}` : ""}
              </span>
            ) : null}
          </p>
          <p style={{ margin: "0 0 0.25rem" }}>
            <span className="muted">Next: </span>
            <strong>{nxt?.bandName || "—"}</strong>
            {m.heroSeconds !== null && m.heroLabel ? (
              <span className="status-warn" style={{ marginLeft: "0.5rem", fontWeight: 600 }}>
                {m.heroLabel}: {formatCountdownOrDays(m.heroSeconds)}
              </span>
            ) : null}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            <Link to={`/stage-days/${item.day.id}`}>Running order</Link>
            {" · "}
            <Link to={`/patch/${nxt?.id ?? cur?.id ?? sorted[0]?.id}`}>Patch</Link>
          </p>
        </>
      )}
    </li>
  );
}

/**
 * Now/next summary for each stage-day (e.g. every stage running today).
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
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "0.75rem",
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
