import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";

type TimeRes = { iso: string; unixMs: number };

export function MiniClock() {
  const timeQ = useQuery({
    queryKey: ["serverTime"],
    queryFn: () => apiGet<TimeRes>("/api/v1/time"),
    refetchInterval: 60_000,
  });

  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    if (timeQ.data) setOffsetMs(timeQ.data.unixMs - Date.now());
  }, [timeQ.data]);

  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(tick + offsetMs), [tick, offsetMs]);
  const hhmm = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

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
