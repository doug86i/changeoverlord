import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet, apiSend } from "../api/client";
import type { EventRow, PaginatedEventsResponse } from "../api/types";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ImportEventButton } from "../components/ExportImportTools";
import { formatDateFriendly } from "../lib/dateFormat";

export function EventsPage() {
  const qc = useQueryClient();
  const EVENT_PAGE = 200;
  const eventsQ = useInfiniteQuery({
    queryKey: ["events"],
    queryFn: ({ pageParam }) =>
      apiGet<PaginatedEventsResponse>(
        `/api/v1/events?page=${pageParam}&limit=${EVENT_PAGE}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const dataEvents =
    eventsQ.data?.pages.flatMap((p) => p.events) ?? [];
  const isLoading = eventsQ.isLoading;
  const error = eventsQ.error;

  const [name, setName] = useState("");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const patchEvent = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiSend(`/api/v1/events/${id}`, "PATCH", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setEditId(null);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => apiSend(`/api/v1/events/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setDeleteId(null);
    },
  });

  if (isLoading) return <p className="muted">Loading events…</p>;
  if (error) return <p role="alert">Failed to load events.</p>;

  const sorted = [...dataEvents].sort(
    (a, b) => b.startDate.localeCompare(a.startDate),
  );

  const deleteEvt = sorted.find((e) => e.id === deleteId);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h1 style={{ margin: 0 }}>Events</h1>
        <ImportEventButton />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          New event
        </div>
        <div className="form-row">
          <label>
            <span className="form-label">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Festival 2026"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <span className="form-label">Start</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">End</span>
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
          <p role="alert" style={{ color: "var(--color-danger)", marginTop: "0.75rem" }}>
            {(create.error as Error).message}
          </p>
        )}
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {sorted.map((e) => (
          <li key={e.id} className="card" style={{ marginBottom: "0.75rem" }}>
            {editId === e.id ? (
              <div className="form-row">
                <input
                  value={editName}
                  onChange={(ev) => setEditName(ev.target.value)}
                />
                <input type="date" value={editStart} onChange={(ev) => setEditStart(ev.target.value)} />
                <input type="date" value={editEnd} onChange={(ev) => setEditEnd(ev.target.value)} />
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    patchEvent.mutate({
                      id: e.id,
                      body: { name: editName, startDate: editStart, endDate: editEnd },
                    })
                  }
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditId(null)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <div>
                  <Link to={`/events/${e.id}`} style={{ fontWeight: 600 }}>
                    {e.name}
                  </Link>
                  <div className="muted" style={{ marginTop: "0.25rem" }}>
                    {formatDateFriendly(e.startDate)} → {formatDateFriendly(e.endDate)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Edit"
                    onClick={() => {
                      setEditId(e.id);
                      setEditName(e.name);
                      setEditStart(e.startDate);
                      setEditEnd(e.endDate);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger-text"
                    title="Delete"
                    onClick={() => setDeleteId(e.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {sorted.length === 0 && (
        <div className="empty-state card">
          <h2>Welcome to Changeoverlord</h2>
          <p>
            Create your first event to get started. An event is a festival,
            tour, or gig. You'll add stages and days inside it.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete event"
        message={deleteEvt ? `Delete "${deleteEvt.name}"? This will permanently remove all stages, days, performances, patch workbooks, and uploaded files for this event.` : ""}
        onConfirm={() => deleteId && deleteEvent.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {eventsQ.hasNextPage && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button
            type="button"
            disabled={eventsQ.isFetchingNextPage}
            onClick={() => void eventsQ.fetchNextPage()}
          >
            {eventsQ.isFetchingNextPage ? "Loading…" : "Load more events"}
          </button>
        </div>
      )}
    </div>
  );
}
