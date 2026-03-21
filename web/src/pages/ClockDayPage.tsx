import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiGet } from "../api/client";
import type { EventRow, PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { ClockEndOfDayOverlay } from "../components/ClockEndOfDayOverlay";
import {
  findNextStageDay,
  getLastPerformanceEndMs,
  HOUR_AFTER_LAST_MS,
} from "../lib/clockSchedule";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useClockNav } from "../ClockNavContext";
import { useFitCountdownInBox } from "../hooks/useFitCountdownInBox";
import {
  formatDateShort,
  minutesBetween,
  formatDuration,
  formatCountdown,
  formatCountdownOrDays,
  formatClockHeroCountdown,
} from "../lib/dateFormat";

type TimeRes = { iso: string; unixMs: number };

function parseLocal(dayDate: string, hhmm: string): Date {
  return new Date(`${dayDate}T${hhmm}:00`);
}

function sortPerformances(p: PerformanceRow[]): PerformanceRow[] {
  return [...p].sort((a, b) => {
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

function warningClass(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds <= 60) return "status-danger";
  if (seconds <= 300) return "status-warn";
  return "status-ok";
}

/** Green → amber → red; final minute uses flashing red (CSS class). */
function urgencyFromSeconds(seconds: number | null): {
  tier: "ok" | "warn" | "danger";
  flash: boolean;
} {
  if (seconds === null) return { tier: "ok", flash: false };
  if (seconds <= 60) return { tier: "danger", flash: true };
  if (seconds <= 300) return { tier: "warn", flash: false };
  return { tier: "ok", flash: false };
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
  const { setPreferredStageDayId } = useClockNav();
  const navigatedRef = useRef(false);
  const { stageDayId } = useParams<{ stageDayId: string }>();
  const [searchParams] = useSearchParams();
  /** Same distance layout as fullscreen, but without the Fullscreen API — bookmarkable, works on some tablets / split-screen. */
  const distanceOnlyNoFs = searchParams.get("kiosk") === "1";

  const arenaRef = useRef<HTMLDivElement>(null);
  const [fsIntent, setFsIntent] = useState(false);
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
  const stageId = dayQ.data?.stageDay?.stageId;

  const stageDaysQ = useQuery({
    queryKey: ["stageDays", stageId],
    queryFn: () =>
      apiGet<{ stageDays: StageDayRow[] }>(`/api/v1/stages/${stageId}/days`),
    enabled: Boolean(stageId),
  });

  const eventId = stageQ.data?.stage?.eventId;
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
    () => sortPerformances(nextDayPerfQ.data?.performances ?? []),
    [nextDayPerfQ.data],
  );

  const lastEndMs = useMemo(
    () => getLastPerformanceEndMs(dayDate, sorted),
    [dayDate, sorted],
  );
  const advanceAtMs = lastEndMs !== null ? lastEndMs + HOUR_AFTER_LAST_MS : null;
  const tMs = now.getTime();
  const hasSchedule = sorted.length > 0;
  const inGraceWindow =
    hasSchedule &&
    lastEndMs !== null &&
    advanceAtMs !== null &&
    tMs >= lastEndMs &&
    tMs < advanceAtMs;
  const pastGraceWindow =
    hasSchedule && lastEndMs !== null && advanceAtMs !== null && tMs >= advanceAtMs;

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

  const { currentIdx, nextIdx, secondsToNext, secondsRemaining } = useMemo(() => {
    if (!dayDate || sorted.length === 0) {
      return { currentIdx: -1, nextIdx: -1, secondsToNext: null as number | null, secondsRemaining: null as number | null };
    }
    let current = -1;
    let remaining: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const start = parseLocal(dayDate, p.startTime);
      const nextStart = sorted[i + 1] ? parseLocal(dayDate, sorted[i + 1].startTime) : null;
      const end = p.endTime ? parseLocal(dayDate, p.endTime) : nextStart;
      if (now >= start && (!end || now < end)) {
        current = i;
        if (end) remaining = Math.floor((end.getTime() - now.getTime()) / 1000);
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
    return { currentIdx: current, nextIdx: next, secondsToNext: sec, secondsRemaining: remaining };
  }, [dayDate, sorted, now]);

  const { heroSeconds, heroLabel } = useMemo(() => {
    if (!dayDate || sorted.length === 0) {
      return { heroSeconds: null as number | null, heroLabel: "" };
    }
    if (currentIdx >= 0) {
      if (secondsRemaining !== null) {
        return { heroSeconds: secondsRemaining, heroLabel: "Time left" };
      }
      if (secondsToNext !== null) {
        return { heroSeconds: secondsToNext, heroLabel: "Until next act" };
      }
      return { heroSeconds: null, heroLabel: "On stage" };
    }
    if (secondsToNext !== null) {
      return { heroSeconds: secondsToNext, heroLabel: "Next act in" };
    }
    return { heroSeconds: null, heroLabel: "Finished" };
  }, [dayDate, sorted.length, currentIdx, secondsRemaining, secondsToNext]);

  /** Gap between acts (or before first): nobody on stage, next act is coming. */
  const isChangeover = useMemo(
    () => currentIdx < 0 && nextIdx >= 0 && secondsToNext !== null,
    [currentIdx, nextIdx, secondsToNext],
  );

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
  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
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

  const goPrev = useCallback(() => setFocusIdx((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setFocusIdx((i) => Math.min(sorted.length - 1, i + 1)), [sorted.length]);

  const distanceMode = distanceOnlyNoFs || fsIntent || isFs;

  const countdownMeasureRef = useRef<HTMLDivElement>(null);
  const countdownTextRef = useRef<HTMLDivElement>(null);
  const countdownDisplay = useMemo(
    () =>
      heroSeconds !== null ? formatClockHeroCountdown(heroLabel, heroSeconds) : "—",
    [heroLabel, heroSeconds],
  );
  useFitCountdownInBox(countdownMeasureRef, countdownTextRef, countdownDisplay, distanceMode);

  useEffect(() => {
    const onFs = () => {
      const el = arenaRef.current;
      setIsFs(isArenaFullscreen(el));
      /** Do not clear `fsIntent` here — the browser may leave fullscreen on resize/snap;
       *  keep the distance layout until F / Exit fullscreen / Compact clock. */
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
      setFsIntent(false);
      return;
    }
    setFsIntent(true);
    requestAnimationFrame(() => {
      void requestFullscreenOn(el).catch(() => setFsIntent(false));
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
  const heroClass =
    heroUrgency.tier === "ok"
      ? "clock-arena-hero--ok"
      : heroUrgency.tier === "warn"
        ? "clock-arena-hero--warn"
        : "clock-arena-hero--danger";
  const heroFlashClass =
    heroUrgency.tier === "danger" && heroUrgency.flash ? " clock-arena-hero--flash" : "";

  if (!stageDayId) return null;
  if (dayQ.isLoading || perfQ.isLoading) return <p className="muted">Loading…</p>;
  if (!dayQ.data) return <p role="alert">Day not found.</p>;

  const stage = stageQ.data?.stage;
  const focus = sorted[focusIdx];
  const changeoverToFocus = focusIdx > 0 && focus
    ? minutesBetween(sorted[focusIdx - 1].endTime, focus.startTime)
    : null;

  const clockFontSize = "clamp(2.5rem, 10vw, 4rem)";
  const bandFontSize = "clamp(1.5rem, 5vw, 2.25rem)";

  const wallTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const commonEnd = {
    stageName: stage?.name ?? "This stage",
    eventName: eventQ.data?.event?.name ?? "the event",
    currentDayLabel: formatDateShort(dayDate),
  };

  let endOfDayOverlay: ReactNode = null;
  if (hasSchedule && lastEndMs !== null && advanceAtMs !== null) {
    const t = now.getTime();
    if (t >= lastEndMs) {
      if (t < advanceAtMs) {
        if (nextStageDay === undefined) {
          endOfDayOverlay = (
            <ClockEndOfDayOverlay mode="grace_next" {...commonEnd} nextDayLoading />
          );
        } else if (nextStageDay === null) {
          endOfDayOverlay = (
            <ClockEndOfDayOverlay mode="grace_final" {...commonEnd} />
          );
        } else {
          endOfDayOverlay = (
            <ClockEndOfDayOverlay
              mode="grace_next"
              {...commonEnd}
              nextDayLabel={formatDateShort(nextStageDay.dayDate)}
              nextPerformances={nextSorted}
              nextDayLoading={nextDayPerfQ.isLoading}
            />
          );
        }
      } else if (nextStageDay === undefined) {
        endOfDayOverlay = (
          <div className="clock-end-overlay" role="status">
            <div className="clock-end-overlay-inner">
              <p className="clock-end-overlay-title">Next day</p>
              <p className="clock-end-overlay-muted">Loading schedule…</p>
            </div>
          </div>
        );
      } else if (nextStageDay === null) {
        endOfDayOverlay = <ClockEndOfDayOverlay mode="thank_you" {...commonEnd} />;
      }
    }
  }

  return (
    <div
      style={{
        minHeight: distanceMode ? "100dvh" : "100%",
        maxWidth: distanceMode ? "none" : 900,
        margin: "0 auto",
        padding: distanceMode ? 0 : "0 1rem 2rem",
        display: distanceMode ? "flex" : undefined,
        flexDirection: distanceMode ? "column" : undefined,
      }}
    >
      {showMessage && message && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-overlay)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          onClick={() => setShowMessage(false)}
        >
          <div
            style={{
              color: "var(--color-on-brand)",
              background: "var(--color-brand)",
              fontSize: "clamp(2rem, 8vw, 5rem)",
              fontWeight: 700,
              textAlign: "center",
              padding: "2rem",
              maxWidth: "90vw",
              borderRadius: "var(--radius-md)",
            }}
          >
            {message}
          </div>
        </div>
      )}

      {!distanceMode && (
        <p className="muted" style={{ marginTop: 0 }}>
          {stage && (
            <>
              <Link to={`/events/${stage.eventId}`}>Event</Link>
              {" / "}
              <Link to={`/stages/${stage.id}`}>{stage.name}</Link>
              {" / "}
            </>
          )}
          {formatDateShort(dayDate)} ·{" "}
          <Link to={`/stage-days/${stageDayId}`}>Edit running order</Link>
        </p>
      )}

      <div
        ref={arenaRef}
        className={distanceMode ? "clock-arena clock-arena--fill" : "clock-compact-wrap"}
      >
        {endOfDayOverlay}
        {distanceMode ? (
          <div className="clock-arena-inner">
            <div className="clock-arena-top-meta">
              {isChangeover && (
                <div className="clock-arena-changeover-strip">Changeover</div>
              )}
              {isChangeover ? (
                <div className="clock-arena-top-band">
                  Next: <strong>{actPresentation.title}</strong>
                </div>
              ) : currentIdx >= 0 ? (
                <>
                  <div className="clock-arena-top-band">
                    {actPresentation.title}
                  </div>
                  <div style={{ marginTop: "0.35rem" }}>
                    <span className="clock-arena-badge clock-arena-badge--on">On stage</span>
                  </div>
                  {actPresentation.sub ? (
                    <div className="clock-arena-label clock-arena-label--slot">{actPresentation.sub}</div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="clock-arena-top-band">{actPresentation.title}</div>
                  {actPresentation.sub ? (
                    <div className="clock-arena-label clock-arena-label--slot">{actPresentation.sub}</div>
                  ) : null}
                </>
              )}
            </div>
            <div className="clock-arena-countdown-region" aria-live="polite">
              <div className="clock-arena-countdown-label">{heroLabel}</div>
              <div className="clock-arena-countdown-measurer" ref={countdownMeasureRef}>
                <div
                  ref={countdownTextRef}
                  className={`clock-arena-countdown-top clock-arena-countdown-top--fit ${heroClass}${heroFlashClass}`}
                  title={
                    heroSeconds !== null
                      ? `${heroLabel}: ${formatClockHeroCountdown(heroLabel, heroSeconds)}`
                      : undefined
                  }
                >
                  {countdownDisplay}
                </div>
              </div>
            </div>

            {/* Middle: local time of day */}
            <div className="clock-arena-wall-mid">
              <div className="clock-arena-wall-caption">Local time</div>
              <div className="clock-arena-wall clock-arena-wall--primary" aria-label="Current time">
                {wallTime}
              </div>
            </div>

            {/* Bottom: metadata in columns */}
            <footer className="clock-arena-footer">
              <div className="clock-arena-footer-grid">
                <div className="clock-arena-footer-cell">
                  <div className="clock-arena-footer-label">Stage</div>
                  <div className="clock-arena-footer-value">{stage?.name ?? "—"}</div>
                </div>
                <div className="clock-arena-footer-cell">
                  <div className="clock-arena-footer-label">Date</div>
                  <div className="clock-arena-footer-value">{formatDateShort(dayDate)}</div>
                </div>
                <div className="clock-arena-footer-cell">
                  <div className="clock-arena-footer-label">Countdown pace</div>
                  <div className="clock-arena-footer-value">
                    {heroSeconds === null
                      ? "—"
                      : heroUrgency.tier === "ok"
                        ? "> 5 min — OK"
                        : heroUrgency.tier === "warn"
                          ? "≤ 5 min — hurry"
                          : "≤ 1 min — final"}
                  </div>
                </div>
                <div className="clock-arena-footer-cell">
                  <div className="clock-arena-footer-label">
                    {isChangeover ? "Next start" : currentIdx >= 0 ? "Slot" : "Status"}
                  </div>
                  <div className="clock-arena-footer-value">
                    {isChangeover && nextIdx >= 0
                      ? sorted[nextIdx]?.startTime ?? "—"
                      : currentIdx >= 0 && sorted[currentIdx]
                        ? sorted[currentIdx].endTime
                          ? `${sorted[currentIdx].startTime}–${sorted[currentIdx].endTime}`
                          : `${sorted[currentIdx].startTime}–…`
                        : actPresentation.badge === "idle"
                          ? "—"
                          : actPresentation.sub || "—"}
                  </div>
                </div>
              </div>

              <div className="clock-arena-footer-actions">
                {distanceOnlyNoFs ? (
                  <Link
                    to={`/clock/day/${stageDayId}`}
                    className="icon-btn"
                    title="Return to the full clock with band list and controls"
                  >
                    Full clock — controls &amp; schedule
                  </Link>
                ) : (
                  <>
                    {isFs && (
                      <button type="button" className="primary" onClick={toggleFullscreen}>
                        Exit fullscreen (F)
                      </button>
                    )}
                    {fsIntent && !isFs && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setFsIntent(false)}
                        title="Leave large layout — show band list and controls"
                      >
                        Compact clock
                      </button>
                    )}
                  </>
                )}
              </div>
            </footer>
          </div>
        ) : (
          <>
            {stage && (
              <h1 style={{ marginTop: 0 }}>
                {stage.name} — {formatDateShort(dayDate)}
              </h1>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <button type="button" onClick={goPrev} disabled={focusIdx <= 0}>← Prev</button>
              <button type="button" onClick={goNext} disabled={focusIdx >= sorted.length - 1}>Next →</button>
              <button type="button" className="primary" onClick={toggleFullscreen}>
                Fullscreen (F)
              </button>
              <Link
                to={`/clock/day/${stageDayId}?kiosk=1`}
                className="icon-btn"
                title="Large distance layout in the normal browser window — no fullscreen. Use for bookmarks, tablets, or split-screen."
              >
                Distance view
              </Link>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
                Auto-advance
              </label>
              <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Stage message…"
                  style={{ width: 160, minHeight: 36 }}
                />
                <button type="button" onClick={() => setShowMessage(true)} disabled={!message}>
                  Show
                </button>
              </div>
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
                  fontSize: clockFontSize,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                }}
              >
                {wallTime}
              </div>
              {secondsToNext !== null && (
                <div style={{ marginTop: "0.5rem", fontSize: "1rem" }}>
                  Next in{" "}
                  <strong className={warningClass(secondsToNext)}>
                    {formatCountdownOrDays(secondsToNext)}
                  </strong>
                </div>
              )}
              {secondsRemaining !== null && currentIdx >= 0 && (
                <div style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
                  Remaining:{" "}
                  <strong className={warningClass(secondsRemaining)}>
                    {formatCountdown(secondsRemaining)}
                  </strong>
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: "1rem" }}>
              <div className="title-bar" style={{ marginBottom: "0.5rem" }}>
                {focusIdx === currentIdx ? "On Stage" : focusIdx === nextIdx ? "Next Up" : "Focus"}
              </div>
              {focus ? (
                <>
                  <div style={{ fontSize: bandFontSize, fontWeight: 700, color: focusIdx === currentIdx ? "var(--color-brand)" : "var(--color-text)" }}>
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
                  {focus.notes && <p style={{ marginTop: "0.75rem" }}>{focus.notes}</p>}
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
                    onClick={() => { setFocusIdx(i); setAutoAdvance(false); }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      marginBottom: 4,
                      border: i === focusIdx ? "2px solid var(--color-brand)" : "1px solid var(--color-border)",
                      background: i === currentIdx ? "var(--color-surface)" : "var(--color-bg)",
                    }}
                  >
                    <strong>{p.bandName || "—"}</strong>{" "}
                    <span className="muted">
                      {p.startTime}
                      {p.endTime ? ` – ${p.endTime}` : ""}
                    </span>
                    {i === currentIdx && <span className="status-ok" style={{ marginLeft: "0.5rem", fontSize: "0.75rem", fontWeight: 600 }}>● ON</span>}
                    {i === nextIdx && <span className="status-warn" style={{ marginLeft: "0.5rem", fontSize: "0.75rem", fontWeight: 600 }}>● NEXT</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
