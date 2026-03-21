import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, apiSend } from "../api/client";
import type { EventRow } from "../api/types";
import { useState } from "react";

export function EventsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: () => apiGet<{ events: EventRow[] }>("/api/v1/events"),
  });

  const [name, setName] = useState("");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const create = useMutation({
    mutationFn: () =>
      apiSend<{ event: EventRow }>("/api/v1/events", "POST", {
        name: name || "New event",
        startDate: start,
        endDate: end,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setName("");
    },
  });

  if (isLoading) return <p className="muted">Loading events…</p>;
  if (error) return <p role="alert">Failed to load events.</p>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Events</h1>
      <p className="muted">
        Create an event, then add stages, days, and performances. Times are{" "}
        <strong>local</strong> to the show.
      </p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          New event
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "1fr 1fr 1fr auto",
            alignItems: "end",
          }}
        >
          <label>
            <span className="muted" style={{ display: "block", marginBottom: 4 }}>
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Festival 2026"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <span className="muted" style={{ display: "block", marginBottom: 4 }}>
              Start
            </span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            <span className="muted" style={{ display: "block", marginBottom: 4 }}>
              End
            </span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button
            type="button"
            className="primary"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            Create
          </button>
        </div>
        {create.isError && (
          <p style={{ color: "var(--color-brand)", marginTop: "0.75rem" }}>
            {(create.error as Error).message}
          </p>
        )}
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {data!.events.map((e) => (
          <li key={e.id} className="card" style={{ marginBottom: "0.75rem" }}>
            <Link to={`/events/${e.id}`} style={{ fontWeight: 600 }}>
              {e.name}
            </Link>
            <div className="muted" style={{ marginTop: "0.25rem" }}>
              {e.startDate} → {e.endDate}
            </div>
          </li>
        ))}
      </ul>
      {data!.events.length === 0 && (
        <p className="muted">No events yet — create one above.</p>
      )}
    </div>
  );
}
