import { useEffect, useState } from "react";
import { ensurePdfJsWorker, pdfjsLib } from "../lib/pdfjs";

const THUMB_MAX_WIDTH = 120;

type Props = {
  fileId: string;
  pageCount: number;
  selectedOneBased: number;
  onSelect: (oneBased: number) => void;
};

/**
 * Renders one thumbnail per PDF page (client-side via pdf.js) so the user can pick a page visually.
 */
export function PdfPageThumbnailGrid({
  fileId,
  pageCount,
  selectedOneBased,
  onSelect,
}: Props) {
  const [thumbs, setThumbs] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setThumbs(null);
    setError(null);

    const run = async () => {
      if (pageCount < 1) return;
      ensurePdfJsWorker();
      try {
        const r = await fetch(`/api/v1/files/${fileId}/raw`, { credentials: "include" });
        if (!r.ok) {
          setError(r.status === 401 ? "Sign in to load previews." : "Could not load PDF.");
          return;
        }
        const buf = await r.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buf),
          useSystemFonts: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        });
        const pdf = await loadingTask.promise;
        try {
          const n = pdf.numPages;
          const urls: string[] = [];
          for (let i = 1; i <= n; i++) {
            if (cancelled) return;
            const page = await pdf.getPage(i);
            const base = page.getViewport({ scale: 1 });
            const scale = THUMB_MAX_WIDTH / base.width;
            const vp = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { alpha: false });
            if (!ctx) {
              setError("Canvas is not available in this browser.");
              return;
            }
            canvas.width = Math.floor(vp.width);
            canvas.height = Math.floor(vp.height);
            const renderTask = page.render({
              canvasContext: ctx,
              viewport: vp,
            });
            await renderTask.promise;
            urls.push(canvas.toDataURL("image/jpeg", 0.82));
          }
          if (!cancelled) setThumbs(urls);
        } finally {
          await pdf.destroy().catch(() => {});
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Preview failed.");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fileId, pageCount]);

  if (error) {
    return (
      <p className="muted" role="alert" style={{ margin: "0.25rem 0" }}>
        {error}
      </p>
    );
  }

  if (!thumbs) {
    return (
      <p className="muted" style={{ margin: "0.25rem 0" }}>
        Rendering page previews…
      </p>
    );
  }

  return (
    <div
      className="pdf-page-thumbnail-grid"
      role="radiogroup"
      aria-label="Choose a page to extract"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.6rem",
        marginTop: "0.5rem",
        maxHeight: "min(42vh, 360px)",
        overflowY: "auto",
        padding: "2px",
      }}
    >
      {thumbs.map((src, idx) => {
        const page = idx + 1;
        const selected = page === selectedOneBased;
        return (
          <button
            key={page}
            type="button"
            className="pdf-thumb-btn"
            role="radio"
            aria-checked={selected}
            title={`Page ${page}`}
            onClick={() => onSelect(page)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: "0.25rem",
              padding: "0.35rem",
              margin: 0,
              minHeight: 0,
              width: "auto",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              border: selected
                ? "2px solid var(--color-brand)"
                : "1px solid var(--color-border)",
              background: selected ? "color-mix(in srgb, var(--color-brand) 12%, var(--color-surface))" : "var(--color-surface)",
              boxShadow: selected ? "0 0 0 1px color-mix(in srgb, var(--color-brand) 35%, transparent)" : "none",
            }}
          >
            <img
              src={src}
              alt=""
              width={THUMB_MAX_WIDTH}
              height="auto"
              style={{
                display: "block",
                borderRadius: "calc(var(--radius-sm) - 2px)",
                maxWidth: THUMB_MAX_WIDTH,
                height: "auto",
              }}
            />
            <span
              className="muted"
              style={{ fontSize: "0.75rem", textAlign: "center" }}
            >
              Page {page}
            </span>
          </button>
        );
      })}
    </div>
  );
}
