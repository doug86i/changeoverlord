import type { PerformanceRow } from "../api/types";

type Mode = "grace_next" | "grace_final" | "thank_you";

export function ClockEndOfDayOverlay({
  mode,
  stageName,
  eventName,
  currentDayLabel,
  nextDayLabel,
  nextPerformances,
  nextDayLoading,
}: {
  mode: Mode;
  stageName: string;
  eventName: string;
  /** Short formatted label, e.g. "Sat 21 Mar". */
  currentDayLabel: string;
  nextDayLabel?: string;
  nextPerformances?: PerformanceRow[];
  nextDayLoading?: boolean;
}) {
  return (
    <div className="clock-end-overlay" role="region" aria-live="polite">
      <div className="clock-end-overlay-inner">
        {mode === "grace_next" && (
          <>
            <p className="clock-end-overlay-kicker">That’s a wrap for {currentDayLabel}</p>
            <h2 className="clock-end-overlay-title">See you next time we’re on</h2>
            <p className="clock-end-overlay-lead">
              <strong>{stageName}</strong> is looking forward to seeing you on{" "}
              <strong>{nextDayLabel ?? "the next day"}</strong>.
            </p>
            <div className="clock-end-overlay-lineup">
              <h3 className="clock-end-overlay-lineup-title">Next day’s lineup</h3>
              {nextDayLoading ? (
                <p className="clock-end-overlay-muted">Loading…</p>
              ) : nextPerformances && nextPerformances.length > 0 ? (
                <ul className="clock-end-overlay-list">
                  {nextPerformances.map((p) => (
                    <li key={p.id}>
                      <span className="clock-end-overlay-band">{p.bandName || "—"}</span>
                      <span className="clock-end-overlay-time">{p.startTime}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="clock-end-overlay-muted">No acts listed yet — check back soon.</p>
              )}
            </div>
            <p className="clock-end-overlay-foot">
              {eventName} · The clock will move to the next day automatically.
            </p>
          </>
        )}
        {(mode === "grace_final" || mode === "thank_you") && (
          <>
            <p className="clock-end-overlay-kicker">
              {mode === "grace_final" ? `End of ${currentDayLabel}` : "Thank you"}
            </p>
            <h2 className="clock-end-overlay-title">What a run</h2>
            <p className="clock-end-overlay-lead">
              Thank you to everyone who made <strong>{stageName}</strong> happen — crew, artists, and everyone
              behind the scenes. You brought the music to life.
            </p>
            <p className="clock-end-overlay-lead">
              Rest up, travel safe, and we hope to see you at <strong>{eventName}</strong> again.
            </p>
            <p className="clock-end-overlay-foot">{currentDayLabel}</p>
          </>
        )}
      </div>
    </div>
  );
}
