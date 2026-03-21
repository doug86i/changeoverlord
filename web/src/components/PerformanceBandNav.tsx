import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
import type { PerformanceRow } from "../api/types";
import { useMemo, useEffect } from "react";

type Props = {
  performanceId: string;
  stageDayId: string;
  /** "patch" links to /patch/:id, "files" links to /performances/:id/files */
  mode: "patch" | "files";
};

export function PerformanceBandNav({ performanceId, stageDayId, mode }: Props) {
  const perfsQ = useQuery({
    queryKey: ["performances", stageDayId],
    queryFn: () =>
      apiGet<{ performances: PerformanceRow[] }>(
        `/api/v1/stage-days/${stageDayId}/performances`,
      ),
    enabled: Boolean(stageDayId),
  });

  const sorted = useMemo(
    () =>
      [...(perfsQ.data?.performances ?? [])].sort((a, b) => {
        const t = a.startTime.localeCompare(b.startTime);
        if (t !== 0) return t;
        return a.id.localeCompare(b.id);
      }),
    [perfsQ.data],
  );

  const idx = sorted.findIndex((p) => p.id === performanceId);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.altKey && e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        window.location.href = mode === "patch" ? `/patch/${prev.id}` : `/performances/${prev.id}/files`;
      }
      if (e.altKey && e.key === "ArrowRight" && next) {
        e.preventDefault();
        window.location.href = mode === "patch" ? `/patch/${next.id}` : `/performances/${next.id}/files`;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, mode]);

  if (!perfsQ.data || sorted.length <= 1) return null;

  const link = (p: PerformanceRow) =>
    mode === "patch" ? `/patch/${p.id}` : `/performances/${p.id}/files`;

  return (
    <nav
      aria-label="Band navigation"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        flexWrap: "wrap",
        marginBottom: "0.75rem",
      }}
    >
      {prev ? (
        <Link to={link(prev)} title={`Previous: ${prev.bandName} (Alt+←)`}>
          ← {prev.bandName}
        </Link>
      ) : (
        <span className="muted">← (first)</span>
      )}
      <span className="muted" style={{ fontSize: "0.8rem" }}>
        {idx + 1} / {sorted.length}
      </span>
      {next ? (
        <Link to={link(next)} title={`Next: ${next.bandName} (Alt+→)`}>
          {next.bandName} →
        </Link>
      ) : (
        <span className="muted">(last) →</span>
      )}
      <select
        value={performanceId}
        onChange={(e) => {
          const p = sorted.find((s) => s.id === e.target.value);
          if (p) window.location.href = link(p);
        }}
        style={{ marginLeft: "auto", maxWidth: 200 }}
      >
        {sorted.map((p) => (
          <option key={p.id} value={p.id}>
            {p.startTime} {p.bandName}
          </option>
        ))}
      </select>
    </nav>
  );
}
