import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";
import { fetchAllEvents } from "../api/paginated";
import type { EventRow, StageRow, StageDayRow } from "../api/types";
import { useEffect, useMemo } from "react";
import { formatDateShort } from "../lib/dateFormat";
import { useServerTime } from "../hooks/useServerTime";

export function ClockPage() {
  const navigate = useNavigate();
  const { now, isLoading: timeLoading } = useServerTime({ tickIntervalMs: 250 });
  const todayStr = now.toISOString().slice(0, 10);

  /** Own key — do not use `["events"]` (that cache holds `useInfiniteQuery` pages from Events). */
  const eventsQ = useQuery({
    queryKey: ["events", "allForClock"],
    queryFn: () => fetchAllEvents(),
  });

  const events = eventsQ.data ?? [];
  const eventIds = events.map((e) => e.id).sort().join(",");

  const stagesQs = useQuery({
    queryKey: ["allStagesForClock", eventIds],
    queryFn: async () => {
      const nested = await Promise.all(
        events.map(async (ev) => {
          const stagesRes = await apiGet<{ stages: StageRow[] }>(
            `/api/v1/events/${ev.id}/stages`,
          );
          return Promise.all(
            stagesRes.stages.map(async (st) => {
              const daysRes = await apiGet<{ stageDays: StageDayRow[] }>(
                `/api/v1/stages/${st.id}/days`,
              );
              return { event: ev, stage: st, days: daysRes.stageDays };
            }),
          );
        }),
      );
      return nested.flat();
    },
    enabled: events.length > 0,
  });

  const todayItems = useMemo(() => {
    if (!stagesQs.data) return [];
    return stagesQs.data.flatMap((r) =>
      r.days
        .filter((d) => d.dayDate === todayStr)
        .map((d) => ({ event: r.event, stage: r.stage, day: d })),
    );
  }, [stagesQs.data, todayStr]);

  useEffect(() => {
    if (todayItems.length === 1) {
      navigate(`/clock/day/${todayItems[0].day.id}`, { replace: true });
    }
  }, [todayItems, navigate]);

  const allDays = useMemo(() => {
    if (!stagesQs.data) return [];
    return stagesQs.data
      .flatMap((r) => r.days.map((d) => ({ event: r.event, stage: r.stage, day: d })))
      .sort((a, b) => a.day.dayDate.localeCompare(b.day.dayDate));
  }, [stagesQs.data]);

  if (eventsQ.isLoading) {
    return <p className="muted">Loading…</p>;
  }
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
      <h1 style={{ marginTop: 0 }}>Clock</h1>
      <div
        className="card"
        style={{
          fontSize: "clamp(2.5rem, 8vw, 4rem)",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          padding: "2rem",
          marginBottom: "1.5rem",
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

      {todayItems.length > 0 && (
        <>
          <h2 className="title-bar">Today's stages</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.5rem" }}>
            {todayItems.map((t) => (
              <li key={t.day.id} className="card" style={{ marginBottom: "0.5rem" }}>
                <Link to={`/clock/day/${t.day.id}`} style={{ fontWeight: 600 }}>
                  {t.stage.name}
                </Link>
                <span className="muted" style={{ marginLeft: "0.5rem" }}>{t.event.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="title-bar">All stage days</h2>
      {allDays.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {allDays.map((t) => (
            <li key={t.day.id} className="card" style={{ marginBottom: "0.5rem" }}>
              <Link to={`/clock/day/${t.day.id}`}>
                {t.stage.name} — {formatDateShort(t.day.dayDate)}
              </Link>
              <span className="muted" style={{ marginLeft: "0.5rem" }}>{t.event.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state card">
          <h2>No stage days</h2>
          <p>
            Create an event with stages and days from the{" "}
            <Link to="/">Events</Link> page, then open any day clock here.
          </p>
        </div>
      )}
    </div>
  );
}
