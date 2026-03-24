import type { PerformanceRow } from "../api/types";
import { formatDuration, slotDurationMinutes } from "../lib/dateFormat";
import {
  buildPerformanceTimeline,
  sortPerformancesByRunOrder,
} from "../lib/performanceTimeline";

type Props = {
  stageName: string;
  dayDate: string;
  performances: PerformanceRow[];
};

export function PrintDaySheet({ stageName, dayDate, performances }: Props) {
  const sorted = sortPerformancesByRunOrder(performances);
  const timeline = buildPerformanceTimeline(dayDate, sorted);

  const handlePrint = () => window.print();

  return (
    <div>
      <button type="button" onClick={handlePrint} className="icon-btn" title="Print running order" style={{ marginBottom: "0.75rem" }}>
        🖨 Print
      </button>
      <div className="print-only" style={{ display: "none" }}>
        <h1>{stageName} — {dayDate}</h1>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "2px solid #000", padding: "0.5rem" }}>Time</th>
              <th style={{ textAlign: "left", borderBottom: "2px solid #000", padding: "0.5rem" }}>Band</th>
              <th style={{ textAlign: "left", borderBottom: "2px solid #000", padding: "0.5rem" }}>Duration</th>
              <th style={{ textAlign: "left", borderBottom: "2px solid #000", padding: "0.5rem" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const dur = p.endTime
                ? slotDurationMinutes(p.startTime, p.endTime)
                : null;
              const changeover =
                i > 0 && timeline[i] && timeline[i - 1] && timeline[i - 1]!.endMs !== null
                  ? Math.round(
                      (timeline[i]!.startMs - timeline[i - 1]!.endMs!) / 60000,
                    )
                  : null;
              return (
                <tr key={p.id}>
                  <td style={{ borderBottom: "1px solid #ccc", padding: "0.5rem", fontVariantNumeric: "tabular-nums" }}>
                    {p.startTime}{p.endTime ? ` – ${p.endTime}` : ""}
                    {changeover !== null && changeover > 0 && (
                      <div style={{ fontSize: "0.75em", color: "#666" }}>↕ {formatDuration(changeover)} c/o</div>
                    )}
                  </td>
                  <td style={{ borderBottom: "1px solid #ccc", padding: "0.5rem", fontWeight: 600 }}>{p.bandName}</td>
                  <td style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>{dur !== null ? formatDuration(dur) : ""}</td>
                  <td style={{ borderBottom: "1px solid #ccc", padding: "0.5rem", fontSize: "0.85rem" }}>{p.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
