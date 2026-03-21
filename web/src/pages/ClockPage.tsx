import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
import { useEffect, useState } from "react";

type TimeRes = { iso: string; unixMs: number };

export function ClockPage() {
  const { data } = useQuery({
    queryKey: ["serverTime"],
    queryFn: () => apiGet<TimeRes>("/api/v1/time"),
    refetchInterval: 30_000,
  });

  /** Difference: serverNow - clientNow at last sync (corrects skew vs browser clock). */
  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    if (data) setOffsetMs(data.unixMs - Date.now());
  }, [data]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const approxServer = new Date(now + offsetMs);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Clock</h1>
      <p className="muted">
        Server time from the Docker host (for countdowns vs your device).
      </p>
      <div
        className="card"
        style={{
          fontSize: "clamp(2.5rem, 8vw, 4rem)",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        {data
          ? approxServer.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "…"}
      </div>
      {data && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Last sync: {new Date(data.iso).toLocaleString()} · adjust host NTP for
          show-critical accuracy.
        </p>
      )}
      <p className="muted" style={{ marginTop: "1.5rem" }}>
        For countdowns and band focus, open a{" "}
        <Link to="/">day</Link> from an event → stage → day, then use{" "}
        <strong>Open stage clock</strong>.
      </p>
    </div>
  );
}
