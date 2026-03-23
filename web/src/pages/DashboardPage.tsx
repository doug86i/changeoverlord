import { useMemo } from "react";
import { Link } from "react-router-dom";
import { TodayStagesStatusGrid } from "../components/TodayStagesStatusGrid";
import {
  flattenStageDaysForClock,
  useAllStagesClockBundle,
} from "../hooks/useAllStagesClockBundle";
import { useServerTime } from "../hooks/useServerTime";
import { formatLocalCalendarDate } from "../lib/dateFormat";

/**
 * Production overview: now/next and changeover hints for every stage that has a day today.
 */
export function DashboardPage() {
  const { now, isLoading: timeLoading } = useServerTime({ tickIntervalMs: 1000 });
  const todayStr = formatLocalCalendarDate(now);

  const { eventsQ, events, stagesQs } = useAllStagesClockBundle();

  const todayItems = useMemo(() => {
    if (!stagesQs.data) return [];
    const flat = flattenStageDaysForClock(stagesQs.data);
    return flat.filter((x) => x.day.dayDate === todayStr);
  }, [stagesQs.data, todayStr]);

  if (eventsQ.isLoading) return <p className="muted">Loading…</p>;
  if (eventsQ.isError || !eventsQ.data) {
    return <p role="alert">Failed to load events.</p>;
  }

  if (events.length > 0 && stagesQs.isLoading) {
    return <p className="muted">Loading…</p>;
  }
  if (events.length > 0 && (stagesQs.isError || !stagesQs.data)) {
    return <p role="alert">Failed to load stages.</p>;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p className="muted">
        Today&apos;s stages — current act, next act, and countdowns ({todayStr}).{" "}
        <Link to="/clock">Open clock hub</Link>
      </p>
      <div
        className="card"
        style={{
          fontSize: "clamp(1.5rem, 5vw, 2.25rem)",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        {!timeLoading
          ? now.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "…"}
      </div>
      <h2 className="title-bar">Stages today</h2>
      <TodayStagesStatusGrid items={todayItems} now={now} />
    </div>
  );
}
