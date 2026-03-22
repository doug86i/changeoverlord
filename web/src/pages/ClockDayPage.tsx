import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiGet, apiSend } from "../api/client";
import type { EventRow, PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { ClockArena } from "../components/ClockArena";
import { PerformanceFilesPanel } from "../components/PerformanceFilesPanel";
import { ClockEndOfDayOverlay } from "../components/ClockEndOfDayOverlay";
import {
  findNextStageDay,
  getLastPerformanceEndMs,
  HOUR_AFTER_LAST_MS,
} from "../lib/clockSchedule";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useClockNav } from "../ClockNavContext";
import { useServerTime } from "../hooks/useServerTime";
import {
  formatDateShort,
  minutesBetween,
  formatDuration,
  formatStageClockCountdown,
} from "../lib/dateFormat";
import {
  computeStageDayClockMetrics,
  emptyStageDayClockMetrics,
  sortPerformancesByStart,
} from "../lib/stageDayClockMetrics";

function warningClass(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds <= 60) return "status-danger";
  if (seconds <= 300) return "status-warn";
  return "status-ok";
}

/** Green → amber → red; final minute uses flashing red (CSS class). */
function urgencyFromSeconds(seconds: number | null): {
  tier: "ok" | "warn" | "danger";
} {
  if (seconds === null) return { tier: "ok" };
  if (seconds <= 60) return { tier: "danger" };
  if (seconds <= 300) return { tier: "warn" };
  return { tier: "ok" };
}

function requestFullscreenOn(el: HTMLElement | null): Promise<void> {
  if (!el) return Promise.reject(new Error("no element"));
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  const req = el.requestFullscreen?.bind(el) ?? anyEl.webkitRequestFullscreen?.bind(el);
  if (!req) return Promise.reject(new Error("fullscreen not supported"));
  const p = req() as Promise<void> | void;
  return p === undefined ? Promise.resolve() : p;
}

function exitFullscreenSafe(): Promise<void> {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
  if (document.fullscreenElement) return Promise.resolve(document.exitFullscreen());
  if (doc.webkitExitFullscreen) return Promise.resolve(doc.webkitExitFullscreen());
  return Promise.resolve();
}

function isArenaFullscreen(el: HTMLElement | null): boolean {
  if (!el) return false;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement === el || doc.webkitFullscreenElement === el;
}

export function ClockDayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setPreferredStageDayId } = useClockNav();
  const navigatedRef = useRef(false);
  const { stageDayId } = useParams<{ stageDayId: string }>();
  const [searchParams] = useSearchParams();

  /** Legacy `?kiosk=1` bookmarks → normal clock (kiosk mode removed). */
  useEffect(() => {
    if (searchParams.get("kiosk") === "1" && stageDayId) {
      navigate({ pathname: `/clock/day/${stageDayId}`, search: "" }, { replace: true });
    }
  }, [searchParams, stageDayId, navigate]);

  const arenaRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);

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

  const { now } = useServerTime({
    tickIntervalMs: 250,
    refetchIntervalMs: 30_000,
  });

  const sorted = useMemo(
    () => sortPerformancesByStart(perfQ.data?.performances ?? []),
    [perfQ.data],
  );

  const dayDate = dayQ.data?.stageDay.dayDate ?? "";
  const stageId = dayQ.data?.stageDay?.stageId;
  const stage = stageQ.data?.stage;

  const stageDaysQ = useQuery({
    queryKey: ["stageDays", stageId],
    queryFn: () =>
      apiGet<{ stageDays: StageDayRow[] }>(`/api/v1/stages/${stageId}/days`),
    enabled: Boolean(stageId),
  });

  const eventId = stage?.eventId;
  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => apiGet<{ event: EventRow }>(`/api/v1/events/${eventId}`),
    enabled: Boolean(eventId),
  });

  const nextStageDay = useMemo((): StageDayRow | null | undefined => {
    if (!stageDayId) return undefined;
    if (stageDaysQ.isLoading && !stageDaysQ.data) return undefined;
    const days = stageDaysQ.data?.stageDays;
    if (!days) return null;
    return findNextStageDay(days, stageDayId);
  }, [stageDayId, stageDaysQ.isLoading, stageDaysQ.data]);

  const nextStageDayId = nextStageDay?.id;
  const nextDayPerfQ = useQuery({
    queryKey: ["performances", nextStageDayId],
    queryFn: () =>
      apiGet<{ performances: PerformanceRow[] }>(
        `/api/v1/stage-days/${nextStageDayId}/performances`,
      ),
    enabled: Boolean(nextStageDayId),
  });

  const nextSorted = useMemo(
    () => sortPerformancesByStart(nextDayPerfQ.data?.performances ?? []),
    [nextDayPerfQ.data],
  );

  const lastEndMs = useMemo(
    () => getLastPerformanceEndMs(dayDate, sorted),
    [dayDate, sorted],
  );
  const advanceAtMs = lastEndMs !== null ? lastEndMs + HOUR_AFTER_LAST_MS : null;
  const hasSchedule = sorted.length > 0;

  useEffect(() => {
    navigatedRef.current = false;
  }, [stageDayId]);

  useEffect(() => {
    if (stageDayId) setPreferredStageDayId(stageDayId);
  }, [stageDayId, setPreferredStageDayId]);

  useEffect(() => {
    if (nextStageDay === undefined || nextStageDay === null) return;
    if (lastEndMs === null || sorted.length === 0) return;
    if (advanceAtMs === null || now.getTime() < advanceAtMs) return;
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigate(`/clock/day/${nextStageDay.id}`, { replace: true });
  }, [nextStageDay, lastEndMs, sorted.length, advanceAtMs, now, navigate]);

  const {
    currentIdx,
    nextIdx,
    secondsToNext,
    secondsRemaining,
    heroSeconds,
    heroLabel,
    clockBanner,
  } = useMemo(() => {
    if (!dayDate || sorted.length === 0) return emptyStageDayClockMetrics();
    return computeStageDayClockMetrics(dayDate, sorted, now);
  }, [dayDate, sorted, now]);

  const actPresentation = useMemo(() => {
    if (sorted.length === 0) {
      return { title: "No performances", sub: "", badge: "idle" as const };
    }
    if (currentIdx >= 0) {
      const p = sorted[currentIdx];
      return {
        title: p.bandName || "—",
        sub: [p.startTime, p.endTime ? p.endTime : null]
          .filter(Boolean)
          .join(" – "),
        badge: "on" as const,
      };
    }
    if (nextIdx >= 0) {
      const p = sorted[nextIdx];
      return {
        title: p.bandName || "—",
        sub: `Starts ${p.startTime}`,
        badge: "next" as const,
      };
    }
    return { title: "Day finished", sub: "", badge: "idle" as const };
  }, [sorted, currentIdx, nextIdx]);

  const [focusIdx, setFocusIdx] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [draftClockMessage, setDraftClockMessage] = useState("");
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

  useEffect(() => {
    if (autoAdvance && currentIdx >= 0) setFocusIdx(currentIdx);
  }, [autoAdvance, currentIdx]);

  useEffect(() => {
    setDraftClockMessage(stage?.clockMessage ?? "");
  }, [stage?.clockMessage]);

  const clockMessageMut = useMutation({
    mutationFn: (body: { message: string | null }) =>
      apiSend<{ stage: StageRow }>(`/api/v1/stages/${stageId}/clock-message`, "PATCH", body),
    onSuccess: (data) => {
      if (stageId) {
        queryClient.setQueryData(["stage", stageId], data);
      }
    },
  });

  const goPrev = useCallback(() => setFocusIdx((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setFocusIdx((i) => Math.min(sorted.length - 1, i + 1)), [sorted.length]);

  useEffect(() => {
    const onFs = () => {
      const el = arenaRef.current;
      setIsFs(isArenaFullscreen(el));
    };
    onFs();
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = arenaRef.current;
    if (!el) return;
    if (isArenaFullscreen(el)) {
      void exitFullscreenSafe();
      return;
    }
    requestAnimationFrame(() => {
      void requestFullscreenOn(el).catch(() => {
        /* user gesture / policy — stay on manager layout */
      });
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, toggleFullscreen]);

  const heroUrgency = urgencyFromSeconds(heroSeconds);
  const dayLabel = formatDateShort(dayDate);

  if (!stageDayId) return null;
  if (dayQ.isLoading || perfQ.isLoading) return <p className="muted">Loading…</p>;
  if (dayQ.isError || (!dayQ.isLoading && !dayQ.data)) {
    return <p role="alert">Day not found.</p>;
  }
  if (perfQ.isError) {
    return <p role="alert">Failed to load performances.</p>;
  }

  const focus = sorted[focusIdx];
  const changeoverToFocus = focusIdx > 0 && focus
    ? minutesBetween(sorted[focusIdx - 1].endTime, focus.startTime)
    : null;

  const bandFontSize = "clamp(1.1rem, 2.5vw, 1.5rem)";

  const wallTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const commonEnd = {
    stageName: stage?.name ?? "This stage",
    eventName: eventQ.data?.event?.name ?? "the event",
    currentDayLabel: dayLabel,
  };

  let endOfDayOverlay: ReactNode = null;
  if (hasSchedule && lastEndMs !== null && advanceAtMs !== null) {
    const t = now.getTime();
    if (t >= lastEndMs) {
      if (t < advanceAtMs) {
        if (nextStageDay === undefined) {
          endOfDayOverlay = (
            <ClockEndOfDayOverlay mode="grace_next" {...commonEnd} nextDayLoading anchored />
          );
        } else if (nextStageDay === null) {
          endOfDayOverlay = (
            <ClockEndOfDayOverlay mode="grace_final" {...commonEnd} anchored />
          );
        } else {
          endOfDayOverlay = (
            <ClockEndOfDayOverlay
              mode="grace_next"
              {...commonEnd}
              nextDayLabel={formatDateShort(nextStageDay.dayDate)}
              nextPerformances={nextSorted}
              nextDayLoading={nextDayPerfQ.isLoading}
              anchored
            />
          );
        }
      } else if (nextStageDay === undefined) {
        endOfDayOverlay = (
          <div
            className="clock-end-overlay clock-end-overlay--anchored"
            role="status"
          >
            <div className="clock-end-overlay-inner">
              <p className="clock-end-overlay-title">Next day</p>
              <p className="clock-end-overlay-muted">Loading schedule…</p>
            </div>
          </div>
        );
      } else if (nextStageDay === null) {
        endOfDayOverlay = (
          <ClockEndOfDayOverlay mode="thank_you" {...commonEnd} anchored />
        );
      }
    }
  }

  const urgentMessage =
    stage?.clockMessage?.trim() ? stage.clockMessage.trim() : null;

  const arenaProps = {
    urgentMessage,
    dayLabel,
    stageName: stage?.name ?? "—",
    sorted,
    currentIdx,
    nextIdx,
    clockBanner,
    actPresentation,
    heroLabel,
    heroSeconds,
    wallTime,
    heroUrgency,
    overlay: endOfDayOverlay,
  };

  const footerManager = (
    <>
      {isFs ? (
        <button type="button" className="primary" onClick={toggleFullscreen}>
          Exit fullscreen (F)
        </button>
      ) : (
        <button type="button" className="primary" onClick={toggleFullscreen}>
          Fullscreen (F)
        </button>
      )}
    </>
  );

  return (
    <div className="clock-day-manager">
      <p className="muted" style={{ marginTop: 0 }}>
        {stage && (
          <>
            <Link to={`/events/${stage.eventId}`}>Event</Link>
            {" / "}
            <Link to={`/stages/${stage.id}`}>{stage.name}</Link>
            {" / "}
          </>
        )}
        {dayLabel} ·{" "}
        <Link to={`/stage-days/${stageDayId}`}>Edit running order</Link>
      </p>

      <div className="clock-day-split">
        <div className="clock-day-arena-wrap card">
          <ClockArena
            ref={arenaRef}
            mode="contained"
            {...arenaProps}
            footerActions={footerManager}
          />
        </div>

        <aside className="clock-day-controls card">
          <h1 className="clock-day-controls-title">
            {stage ? `${stage.name} — ${dayLabel}` : dayLabel}
          </h1>

          <div className="clock-day-controls-body">
          <section className="clock-day-section" aria-labelledby="clock-urgent-heading">
            <h2 id="clock-urgent-heading" className="clock-day-section-title">
              Urgent message
            </h2>
            <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
              Flashes over the clock arena only (countdown area above — not this panel); in fullscreen the arena fills the display. Clear when done.
            </p>
            <textarea
              className="clock-day-message-input"
              value={draftClockMessage}
              onChange={(e) => setDraftClockMessage(e.target.value)}
              placeholder="e.g. STOP — hold the stage"
              rows={3}
              aria-label="Urgent message for clocks"
            />
            <div className="clock-day-message-actions">
              <button
                type="button"
                className="primary"
                disabled={!stageId || clockMessageMut.isPending}
                onClick={() => {
                  const m = draftClockMessage.trim();
                  void clockMessageMut.mutateAsync({ message: m === "" ? null : m });
                }}
              >
                Send to clocks
              </button>
              <button
                type="button"
                className="icon-btn danger-text"
                disabled={!stageId || clockMessageMut.isPending || !urgentMessage}
                onClick={() => {
                  setDraftClockMessage("");
                  void clockMessageMut.mutateAsync({ message: null });
                }}
              >
                Clear
              </button>
            </div>
            {clockMessageMut.isError ? (
              <p className="status-danger" role="alert" style={{ marginBottom: 0 }}>
                Could not update message.
              </p>
            ) : null}
          </section>

          <div className="clock-day-controls-mid">
          <section className="clock-day-section" aria-labelledby="clock-focus-heading">
            <h2 id="clock-focus-heading" className="clock-day-section-title">
              {focusIdx === currentIdx ? "On stage" : focusIdx === nextIdx ? "Next up" : "Focus"}
            </h2>
            {focus ? (
              <div className="clock-day-focus-card">
                <div
                  style={{
                    fontSize: bandFontSize,
                    fontWeight: 700,
                    color: focusIdx === currentIdx ? "var(--color-brand)" : "var(--color-text)",
                  }}
                >
                  {focus.bandName || "—"}
                </div>
                <div className="muted" style={{ marginTop: "0.25rem" }}>
                  {focus.startTime}
                  {focus.endTime ? ` – ${focus.endTime}` : ""}
                  {focus.endTime && focus.startTime && (() => {
                    const dur = minutesBetween(focus.startTime, focus.endTime);
                    return dur !== null ? ` (${formatDuration(dur)})` : "";
                  })()}
                </div>
                {changeoverToFocus !== null && (
                  <div className="muted" style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}>
                    Changeover: {formatDuration(changeoverToFocus)}
                  </div>
                )}
                {secondsToNext !== null && focusIdx === nextIdx && (
                  <div style={{ marginTop: "0.35rem" }}>
                    Starts in{" "}
                    <strong className={warningClass(secondsToNext)}>
                      {formatStageClockCountdown(secondsToNext)}
                    </strong>
                  </div>
                )}
                {secondsRemaining !== null && focusIdx === currentIdx && currentIdx >= 0 && (
                  <div style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
                    {clockBanner === "on_stage_next" ? "Until next act" : "Time left"}:{" "}
                    <strong className={warningClass(secondsRemaining)}>
                      {formatStageClockCountdown(secondsRemaining)}
                    </strong>
                  </div>
                )}
                {focus.notes ? <p style={{ marginTop: "0.75rem" }}>{focus.notes}</p> : null}
              </div>
            ) : null}
            {focus && stageId ? (
              <div className="clock-day-focus-files">
                <div className="clock-day-focus-act-links">
                  <Link to={`/patch/${focus.id}`} className="icon-btn">
                    Patch / RF
                  </Link>
                  <Link to={`/performances/${focus.id}/files`} className="icon-btn">
                    Files page
                  </Link>
                </div>
                <PerformanceFilesPanel
                  performanceId={focus.id}
                  stageId={stageId}
                  title="Files (this act)"
                  collapsedByDefault
                />
              </div>
            ) : null}
            {!focus ? <p className="muted">No performances.</p> : null}
          </section>

          <section className="clock-day-section" aria-labelledby="clock-nav-heading">
            <h2 id="clock-nav-heading" className="clock-day-section-title">
              Focus &amp; navigation
            </h2>
            <div className="clock-day-nav-buttons">
              <button type="button" onClick={goPrev} disabled={focusIdx <= 0}>
                ← Prev
              </button>
              <button type="button" onClick={goNext} disabled={focusIdx >= sorted.length - 1}>
                Next →
              </button>
              <label className="clock-day-auto-label">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                />
                Auto-advance
              </label>
            </div>
          </section>
          </div>

          <section className="clock-day-section clock-day-schedule-section" aria-labelledby="clock-sched-heading">
            <h2 id="clock-sched-heading" className="clock-day-section-title">
              Schedule
            </h2>
            <ul className="clock-day-schedule">
              {sorted.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`clock-day-schedule-row${i === focusIdx ? " clock-day-schedule-row--focus" : ""}`}
                    onClick={() => {
                      setFocusIdx(i);
                      setAutoAdvance(false);
                    }}
                  >
                    <span className="clock-day-schedule-name">{p.bandName || "—"}</span>
                    <span className="muted clock-day-schedule-time">
                      {p.startTime}
                      {p.endTime ? ` – ${p.endTime}` : ""}
                    </span>
                    {i === currentIdx ? (
                      <span className="clock-day-schedule-badge clock-day-schedule-badge--on">ON</span>
                    ) : null}
                    {i === nextIdx ? (
                      <span className="clock-day-schedule-badge clock-day-schedule-badge--next">NEXT</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
