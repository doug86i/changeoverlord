import type { PerformanceRow } from "../api/types";
import {
  formatDateFriendly,
  formatDuration,
  slotDurationMinutes,
} from "../lib/dateFormat";
import {
  buildPerformanceTimeline,
  sortPerformancesByRunOrder,
  timelineStartCalendarDayOffset,
} from "../lib/performanceTimeline";

type Props = {
  eventName: string;
  stageName: string;
  dayDate: string;
  performances: PerformanceRow[];
};

export function PrintDaySheet({
  eventName,
  stageName,
  dayDate,
  performances,
}: Props) {
  const sorted = sortPerformancesByRunOrder(performances);
  const timeline = buildPerformanceTimeline(dayDate, sorted);

  const handlePrint = () => window.print();

  return (
    <div className="print-day-sheet-host">
      <button
        type="button"
        onClick={handlePrint}
        className="icon-btn"
        title="Print running order"
        style={{ marginBottom: "0.75rem" }}
      >
        🖨 Print
      </button>
      <div className="print-schedule print-only">
        {eventName.trim() !== "" ? (
          <h1 className="print-schedule__event">{eventName}</h1>
        ) : null}
        <h2 className="print-schedule__stage">{stageName}</h2>
        <p className="print-schedule__day">{formatDateFriendly(dayDate)}</p>
        <table className="print-schedule__table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Band</th>
              <th scope="col">Duration</th>
              <th scope="col">Notes</th>
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
              const startDayOff =
                timeline[i] !== undefined
                  ? timelineStartCalendarDayOffset(dayDate, timeline[i]!.startMs)
                  : 0;
              return (
                <tr key={p.id}>
                  <td className="print-schedule__time">
                    <span className="print-schedule__time-main">
                      {p.startTime}
                      {startDayOff > 0 ? (
                        <span className="running-order-next-day-badge print-schedule__badge">
                          +{startDayOff}d
                        </span>
                      ) : null}
                      {p.endTime ? ` – ${p.endTime}` : ""}
                    </span>
                    {changeover !== null && changeover > 0 && (
                      <div className="print-schedule__changeover">
                        ↕ {formatDuration(changeover)} c/o
                      </div>
                    )}
                  </td>
                  <td className="print-schedule__band">{p.bandName}</td>
                  <td>{dur !== null ? formatDuration(dur) : ""}</td>
                  <td className="print-schedule__notes">{p.notes ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
