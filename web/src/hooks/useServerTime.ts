import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

type TimeRes = { iso: string; unixMs: number };

/**
 * Monotonic wall clock aligned to `GET /api/v1/time` (LAN clock skew correction).
 */
export function useServerTime(opts?: {
  tickIntervalMs?: number;
  refetchIntervalMs?: number;
}) {
  const tickMs = opts?.tickIntervalMs ?? 250;
  const timeQ = useQuery({
    queryKey: ["serverTime"],
    queryFn: () => apiGet<TimeRes>("/api/v1/time"),
    staleTime: 30_000,
    ...(opts?.refetchIntervalMs != null
      ? { refetchInterval: opts.refetchIntervalMs }
      : {}),
  });
  const [tick, setTick] = useState(() => Date.now());
  const [offsetMs, setOffsetMs] = useState(0);

  useEffect(() => {
    if (!timeQ.data) return;
    setOffsetMs(timeQ.data.unixMs - Date.now());
  }, [timeQ.data]);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const now = new Date(tick + offsetMs);
  return { now, isLoading: timeQ.isLoading };
}
