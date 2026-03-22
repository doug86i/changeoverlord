import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";

const searchResultLinkStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  marginBottom: "0.25rem",
  textDecoration: "none",
  color: "var(--color-text)",
  padding: "0.35rem 0.4rem",
  borderRadius: "var(--radius-sm)",
  boxSizing: "border-box",
};

type SearchResult = {
  performances: { id: string; bandName: string; startTime: string; stageDayId: string }[];
  events: { id: string; name: string; startDate: string }[];
  stages: { id: string; name: string; eventId: string }[];
};

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) {
      clearTimeout(timer.current);
      timer.current = undefined;
      return;
    }
    setQ("");
    setResults(null);
    const focusId = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(focusId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const search = useCallback((term: string) => {
    if (term.length < 1) { setResults(null); return; }
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await apiGet<SearchResult>(`/api/v1/search?q=${encodeURIComponent(term)}`);
        setResults(r);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  if (!open) return null;

  const total = results
    ? results.performances.length + results.events.length + results.stages.length
    : 0;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div
        className="card"
        style={{ maxWidth: 560, width: "100%", maxHeight: "80vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); search(e.target.value); }}
          placeholder="Search bands, events, stages…"
          style={{ width: "100%", marginBottom: "0.75rem" }}
        />
        {loading && <p className="muted">Searching…</p>}
        {results && total === 0 && q.length > 0 && (
          <p className="muted">No results for "{q}".</p>
        )}
        {results && results.events.length > 0 && (
          <>
            <div className="title-bar" style={{ margin: "0.5rem 0 0.25rem" }}>Events</div>
            {results.events.map((e) => (
              <Link
                key={e.id}
                to={`/events/${e.id}`}
                className="search-dialog-result"
                onClick={() => onClose()}
                style={searchResultLinkStyle}
              >
                {e.name} <span className="muted">({e.startDate})</span>
              </Link>
            ))}
          </>
        )}
        {results && results.stages.length > 0 && (
          <>
            <div className="title-bar" style={{ margin: "0.5rem 0 0.25rem" }}>Stages</div>
            {results.stages.map((s) => (
              <Link
                key={s.id}
                to={`/stages/${s.id}`}
                className="search-dialog-result"
                onClick={() => onClose()}
                style={searchResultLinkStyle}
              >
                {s.name}
              </Link>
            ))}
          </>
        )}
        {results && results.performances.length > 0 && (
          <>
            <div className="title-bar" style={{ margin: "0.5rem 0 0.25rem" }}>Performances</div>
            {results.performances.map((p) => (
              <Link
                key={p.id}
                to={`/stage-days/${p.stageDayId}`}
                className="search-dialog-result"
                onClick={() => onClose()}
                style={searchResultLinkStyle}
              >
                {p.bandName} <span className="muted">({p.startTime})</span>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
