import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api/client";
import type { PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TimeRes = { iso: string; unixMs: number };

function parseLocal(dayDate: string, hhmm: string): Date {
  return new Date(`${dayDate}T${hhmm}:00`);
}

function sortPerformances(p: PerformanceRow[]): PerformanceRow[] {
  return [...p].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.startTime.localeCompare(b.startTime);
  });
}

export function ClockDayPage() {
  const { stageDayId } = useParams<{ stageDayId: string }>();

  const dayQ = useQuery({
    queryKey: ["stageDay", stageDayId],
    queryFn: () =>
      apiGet<{ stageDay: StageDayRow }>(`/api/v1/stage-days/${stageDayId}`),
    enabled: Boolean(stageDayId),
  });

  const stageQ = useQuery({
    queryKey: ["stage", dayQ.data?.stageDay?.stageId],
    queryFn: () =>
      apiGet<{ stage: StageRow }>(
        `/api/v1/stages/${dayQ.data!.stageDay.stageId}`,
      ),
    enabled: Boolean(dayQ.data?.stageDay?.stageId),
  });

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
    () => sortPerformances(perfQ.data?.performances ?? []),
    [perfQ.data],
  );

  const dayDate = dayQ.data?.stageDay.dayDate ?? "";

  const { currentIdx, nextIdx, secondsToNext } = useMemo(() => {
    if (!dayDate || sorted.length === 0) {
      return { currentIdx: -1, nextIdx: -1, secondsToNext: null as number | null };
    }
    let current = -1;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const start = parseLocal(dayDate, p.startTime);
      const nextStart = sorted[i + 1]
        ? parseLocal(dayDate, sorted[i + 1].startTime)
        : null;
      const end = p.endTime
        ? parseLocal(dayDate, p.endTime)
        : nextStart;
      if (now >= start && (!end || now < end)) {
        current = i;
        break;
      }
    }
    let next = -1;
    let sec: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const start = parseLocal(dayDate, sorted[i].startTime);
      if (start > now) {
        next = i;
        sec = Math.floor((start.getTime() - now.getTime()) / 1000);
        break;
      }
    }
    return { currentIdx: current, nextIdx: next, secondsToNext: sec };
  }, [dayDate, sorted, now]);

  const [focusIdx, setFocusIdx] = useState(0);
  const focusInitRef = useRef(false);
  const sortedIds = useMemo(() => sorted.map((p) => p.id).join("|"), [sorted]);
  useEffect(() => {
    focusInitRef.current = false;
  }, [stageDayId]);
  useEffect(() => {
    if (focusInitRef.current || sorted.length === 0) return;
    focusInitRef.current = true;
    if (currentIdx >= 0) setFocusIdx(currentIdx);
    else if (nextIdx >= 0) setFocusIdx(nextIdx);
    else setFocusIdx(0);
  }, [sortedIds, sorted.length, currentIdx, nextIdx]);

  const goPrev = useCallback(() => {
    setFocusIdx((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setFocusIdx((i) => Math.min(sorted.length - 1, i + 1));
  }, [sorted.length]);

  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      void el.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, toggleFullscreen]);

  if (!stageDayId) return null;
  if (dayQ.isLoading || perfQ.isLoading) {
    return <p className="muted">Loading…</p>;
  }
  if (!dayQ.data) return <p role="alert">Day not found.</p>;

  const stage = stageQ.data?.stage;
  const focus = sorted[focusIdx];

  const fmtCountdown = (s: number | null) => {
    if (s === null) return "—";
    if (s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        minHeight: "100%",
        maxWidth: 900,
        margin: "0 auto",
        padding: "0 1rem 2rem",
      }}
    >
      <p className="muted" style={{ marginTop: 0 }}>
        {stage && (
          <>
            <Link to={`/events/${stage.eventId}`}>Event</Link>
            {" / "}
            <Link to={`/stages/${stage.id}`}>{stage.name}</Link>
            {" / "}
          </>
        )}
        {dayDate} ·{" "}
        <Link to={`/stage-days/${stageDayId}`}>Edit running order</Link>
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <button type="button" onClick={goPrev} disabled={focusIdx <= 0}>
          ← Prev
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={focusIdx >= sorted.length - 1}
        >
          Next →
        </button>
        <button type="button" onClick={toggleFullscreen}>
          Fullscreen (F)
        </button>
      </div>

      <div
        className="card"
        style={{
          textAlign: "center",
          padding: "1.5rem 1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            fontSize: "clamp(2.5rem, 10vw, 4rem)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
          }}
        >
          {now.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
        <div className="muted" style={{ marginTop: "0.5rem" }}>
          Next act in{" "}
          <strong style={{ color: "var(--color-brand)" }}>
            {fmtCountdown(secondsToNext)}
          </strong>
        </div>
      </div>

      <div className="card">
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          Focus
        </div>
        {focus ? (
          <>
            <div
              style={{
                fontSize: "clamp(1.5rem, 5vw, 2.25rem)",
                fontWeight: 700,
                color:
                  focusIdx === currentIdx
                    ? "var(--color-brand)"
                    : "var(--color-text)",
              }}
            >
              {focus.bandName || "—"}
            </div>
            <div className="muted" style={{ marginTop: "0.25rem" }}>
              {focus.startTime}
              {focus.endTime ? ` – ${focus.endTime}` : ""}
              {focusIdx === currentIdx && (
                <span style={{ marginLeft: "0.5rem" }}>(on stage)</span>
              )}
            </div>
            {focus.notes && (
              <p style={{ marginTop: "0.75rem" }}>{focus.notes}</p>
            )}
          </>
        ) : (
          <p className="muted">No performances.</p>
        )}
      </div>

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
        {sorted.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setFocusIdx(i)}
              style={{
                width: "100%",
                textAlign: "left",
                marginBottom: 6,
                border:
                  i === focusIdx
                    ? "2px solid var(--color-brand)"
                    : "1px solid var(--color-border)",
                background:
                  i === currentIdx ? "var(--color-surface)" : "var(--color-bg)",
              }}
            >
              <strong>{p.bandName || "—"}</strong>{" "}
              <span className="muted">
                {p.startTime}
                {p.endTime ? ` – ${p.endTime}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
