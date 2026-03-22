import { useMemo } from "react";
import { useServerTime } from "../hooks/useServerTime";

export function MiniClock() {
  const { now } = useServerTime({
    tickIntervalMs: 1000,
    refetchIntervalMs: 60_000,
  });
  const hhmm = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [now],
  );

  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        fontWeight: 600,
        fontSize: "0.85rem",
      }}
      title="Server-synced time"
    >
      🕐 {hhmm}
    </span>
  );
}
