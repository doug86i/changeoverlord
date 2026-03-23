import { useMemo } from "react";
import { TodayStagesStatusGrid } from "../components/TodayStagesStatusGrid";
import {
  flattenStageDaysForClock,
  useAllStagesClockBundle,
} from "../hooks/useAllStagesClockBundle";
import { useServerTime } from "../hooks/useServerTime";
import { formatLocalCalendarDate } from "../lib/dateFormat";

/**
 * Production overview: same {@link ClockArena} layout as each stage clock, miniaturized per stage today.
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
      <h1 style={{ marginTop: 0 }}>Event dashboard</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Stages running today on {todayStr}.{" "}
        Local time:{" "}
        {!timeLoading
          ? now.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "…"}
      </p>
      <h2 className="title-bar">Stages today</h2>
      <TodayStagesStatusGrid items={todayItems} now={now} />
    </div>
  );
}
