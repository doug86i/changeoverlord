import {
  forwardRef,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { PerformanceRow } from "../api/types";
import type { ClockBannerMode } from "../lib/stageDayClockMetrics";
import { useFitCountdownInBox } from "../hooks/useFitCountdownInBox";
import { useFitTextInBox } from "../hooks/useFitTextInBox";
import {
  formatClockHeroCountdown,
} from "../lib/dateFormat";

export type ClockArenaActPresentation = {
  title: string;
  sub: string;
  badge: "on" | "next" | "idle";
};

export type ClockArenaHeroUrgency = {
  tier: "ok" | "warn" | "danger";
};

export type ClockArenaProps = {
  mode: "contained" | "fill";
  /** Synced urgent line; flash covers this arena only (not stage manager controls below). */
  urgentMessage: string | null | undefined;
  dayLabel: string;
  stageName: string;
  sorted: PerformanceRow[];
  currentIdx: number;
  nextIdx: number;
  /** TV / distance: when not `none`, shows a high-contrast banner so handover timers are not read as “set length”. */
  clockBanner: ClockBannerMode;
  actPresentation: ClockArenaActPresentation;
  heroLabel: string;
  heroSeconds: number | null;
  wallTime: string;
  heroUrgency: ClockArenaHeroUrgency;
  /** End-of-day / loading overlay (optional). */
  overlay?: ReactNode;
  /** Footer actions inside the arena (e.g. fullscreen toggle). */
  footerActions?: ReactNode;
};

/**
 * Single arena layout for stage clocks — same pixels at any size (countdown scales to container).
 */
export const ClockArena = forwardRef<HTMLDivElement, ClockArenaProps>(
  function ClockArena(
    {
      mode,
      urgentMessage,
      dayLabel,
      stageName,
      sorted,
      currentIdx,
      nextIdx,
      clockBanner,
      actPresentation,
      heroLabel,
      heroSeconds,
      wallTime,
      heroUrgency,
      overlay,
      footerActions,
    },
    ref,
  ) {
    const countdownMeasureRef = useRef<HTMLDivElement>(null);
    const countdownTextRef = useRef<HTMLDivElement>(null);
    const urgentMeasureRef = useRef<HTMLDivElement>(null);
    const urgentTextRef = useRef<HTMLDivElement>(null);

    const heroUrgencyTier = heroUrgency.tier;
    const heroClass =
      heroUrgencyTier === "ok"
        ? "clock-arena-hero--ok"
        : heroUrgencyTier === "warn"
          ? "clock-arena-hero--warn"
          : "clock-arena-hero--danger";
    const heroFlashClass =
      heroUrgencyTier === "danger" && heroSeconds !== null && heroSeconds <= 60
        ? " clock-arena-hero--flash"
        : "";

    const countdownDisplay = useMemo(
      () =>
        heroSeconds !== null ? formatClockHeroCountdown(heroLabel, heroSeconds) : "—",
      [heroLabel, heroSeconds],
    );

    useFitCountdownInBox(countdownMeasureRef, countdownTextRef, countdownDisplay, true);

    const urgent = urgentMessage?.trim() ? urgentMessage.trim() : null;
    useFitTextInBox(urgentMeasureRef, urgentTextRef, urgent ?? "", Boolean(urgent));

    const waitingForNextAct =
      clockBanner === "between_acts" || clockBanner === "pre_show";
    const onStageNextBoundary = clockBanner === "on_stage_next";

    return (
      <div
        ref={ref}
        className={`clock-arena clock-arena--fill${mode === "contained" ? " clock-arena--contained" : ""}`}
      >
        {overlay}
        {urgent ? (
          <div className="clock-urgent-arena-flash" role="alert" aria-live="assertive">
            <div className="clock-urgent-arena-flash-backdrop" aria-hidden />
            <div className="clock-urgent-arena-flash-measurer" ref={urgentMeasureRef}>
              <div ref={urgentTextRef} className="clock-urgent-arena-flash-text">
                {urgent}
              </div>
            </div>
          </div>
        ) : null}
        <div className="clock-arena-inner">
          <div className="clock-arena-top-meta">
            {clockBanner === "between_acts" ? (
              <div
                className="clock-arena-handover-banner clock-arena-handover-banner--gap clock-arena-handover-banner--title-only"
                role="status"
                aria-live="polite"
              >
                <span className="clock-arena-handover-banner__title">Changeover</span>
              </div>
            ) : null}
            {clockBanner === "pre_show" ? (
              <div
                className="clock-arena-handover-banner clock-arena-handover-banner--preshow"
                role="status"
                aria-live="polite"
              >
                <span className="clock-arena-handover-banner__title">Next act</span>
                <span className="clock-arena-handover-banner__sub">Show starts in</span>
              </div>
            ) : null}
            {onStageNextBoundary ? (
              <div
                className="clock-arena-handover-banner clock-arena-handover-banner--on-stage-next"
                role="status"
                aria-live="polite"
              >
                <span className="clock-arena-handover-banner__title">Next act in</span>
                <span className="clock-arena-handover-banner__sub">
                  Not time left in your slot — clear when this hits zero
                </span>
              </div>
            ) : null}
            {waitingForNextAct ? (
              <div className="clock-arena-top-band">
                Next: <strong>{actPresentation.title}</strong>
              </div>
            ) : currentIdx >= 0 ? (
              <>
                <div className="clock-arena-top-band">
                  {actPresentation.title}
                </div>
                <div style={{ marginTop: "0.35rem" }}>
                  <span className="clock-arena-badge clock-arena-badge--on">
                    {onStageNextBoundary ? "On stage now" : "On stage"}
                  </span>
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

          <div className="clock-arena-wall-mid">
            <div className="clock-arena-wall-caption">Local time</div>
            <div className="clock-arena-wall clock-arena-wall--primary" aria-label="Current time">
              {wallTime}
            </div>
          </div>

          <footer className="clock-arena-footer">
            <div className="clock-arena-footer-bar">
              <div className="clock-arena-footer-grid">
                <div className="clock-arena-footer-cell">
                  <div className="clock-arena-footer-label">Stage</div>
                  <div className="clock-arena-footer-value">{stageName || "—"}</div>
                </div>
                <div className="clock-arena-footer-cell">
                  <div className="clock-arena-footer-label">Date</div>
                  <div className="clock-arena-footer-value">{dayLabel}</div>
                </div>
                <div className="clock-arena-footer-cell">
                  <div className="clock-arena-footer-label">Countdown pace</div>
                  <div className="clock-arena-footer-value">
                    {heroSeconds === null
                      ? "—"
                      : heroUrgencyTier === "ok"
                        ? "> 5 min — OK"
                        : heroUrgencyTier === "warn"
                          ? "≤ 5 min — hurry"
                          : "≤ 1 min — final"}
                  </div>
                </div>
                <div className="clock-arena-footer-cell">
                  <div className="clock-arena-footer-label">
                    {waitingForNextAct ? "Next start" : currentIdx >= 0 ? "Slot" : "Status"}
                  </div>
                  <div className="clock-arena-footer-value">
                    {waitingForNextAct && nextIdx >= 0
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
              {footerActions ? (
                <div className="clock-arena-footer-actions clock-arena-footer-actions--inline">
                  {footerActions}
                </div>
              ) : null}
            </div>
          </footer>
        </div>
      </div>
    );
  },
);
