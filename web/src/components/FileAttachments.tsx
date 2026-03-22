import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiSend, apiSendForm } from "../api/client";
import type { FileAssetPurpose, FileAssetRow } from "../api/types";
import { ConfirmDialog } from "./ConfirmDialog";

const RIDER_FILE_ACCEPT =
  "image/*,application/pdf,text/*,.pdf,.doc,.docx,.odt,.rtf,.md,.csv,.txt,.tif,.tiff,.webp,.heic,.heif";

const THUMB_MAX_WIDTH = 120;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FilePurposeToggle({
  purpose,
  disabled,
  onPatch,
}: {
  purpose: FileAssetPurpose;
  disabled: boolean;
  onPatch: (next: FileAssetPurpose) => void;
}) {
  const isRider = purpose === "rider_pdf";
  const isPlot = purpose === "plot_pdf";
  return (
    <div>
      <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.35rem" }}>
        Use as:
      </span>
      <div className="file-purpose-toggle">
        <button
          type="button"
          className={`icon-btn${isRider ? " primary" : ""}`}
          disabled={disabled}
          title={isRider ? "Click to set as Other" : "Rider / tech pack"}
          onClick={() => onPatch(isRider ? "generic" : "rider_pdf")}
        >
          Rider
        </button>
        <button
          type="button"
          className={`icon-btn${isPlot ? " primary" : ""}`}
          disabled={disabled}
          title={isPlot ? "Click to set as Other" : "Stage plot"}
          onClick={() => onPatch(isPlot ? "generic" : "plot_pdf")}
        >
          Stage plot
        </button>
      </div>
    </div>
  );
}

function InlinePdfViewer({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div
        style={{ width: "90vw", height: "90vh", maxWidth: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <button type="button" className="icon-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <iframe
          src={`/api/v1/files/${fileId}/raw`}
          title="PDF viewer"
          style={{ width: "100%", height: "calc(100% - 40px)", border: "none", borderRadius: "var(--radius-md)", background: "var(--color-surface)" }}
        />
      </div>
    </div>
  );
}

function FileRow({
  f,
  queryKey,
  showPurposeToggles,
}: {
  f: FileAssetRow;
  queryKey: unknown[];
  showPurposeToggles: boolean;
}) {
  const qc = useQueryClient();
  const [purpose, setPurpose] = useState<FileAssetPurpose>(f.purpose);
  const [extractOpen, setExtractOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  const isPdf = f.mimeType === "application/pdf";

  const previewsQ = useQuery({
    queryKey: ["file-page-previews", f.id],
    queryFn: () =>
      apiGet<{ pageCount: number; thumbnails: string[] }>(
        `/api/v1/files/${f.id}/page-previews`,
      ),
    enabled: extractOpen && isPdf,
  });

  const del = useMutation({
    mutationFn: () => apiSend(`/api/v1/files/${f.id}`, "DELETE"),
    onSuccess: () => { void qc.invalidateQueries({ queryKey }); setDeleteOpen(false); },
  });

  const extract = useMutation({
    mutationFn: () =>
      apiSend<{ file: FileAssetRow }>(`/api/v1/files/${f.id}/extract-page`, "POST", {
        pageIndex: pageIndex - 1,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey }); setExtractOpen(false); },
  });

  const convertToPdf = useMutation({
    mutationFn: () =>
      apiSend<{ file: FileAssetRow }>(`/api/v1/files/${f.id}/convert-to-pdf`, "POST"),
    onSuccess: () => { void qc.invalidateQueries({ queryKey }); },
  });

  const patchPurpose = useMutation({
    mutationFn: (next: FileAssetPurpose) =>
      apiSend<{ file: FileAssetRow }>(`/api/v1/files/${f.id}`, "PATCH", { purpose: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
    },
    onError: () => {
      setPurpose(f.purpose);
    },
  });

  useEffect(() => {
    setPurpose(f.purpose);
  }, [f.purpose]);

  const openExtract = () => {
    setPageIndex(1);
    setExtractOpen(true);
    extract.reset();
  };

  const pageCount = previewsQ.data?.pageCount ?? 0;
  const thumbs = previewsQ.data?.thumbnails ?? [];
  const canConvert = Boolean(f.canConvertToPdf);

  useEffect(() => {
    if (pageCount > 0 && pageIndex > pageCount) setPageIndex(pageCount);
  }, [pageCount, pageIndex]);

  return (
    <>
      <li className="card" style={{ marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <strong>{f.originalName}</strong>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              {formatBytes(f.byteSize)}
              {f.pageCount ? ` · ${f.pageCount} pages` : ""}
            </div>
            {showPurposeToggles ? (
              <div style={{ marginTop: "0.35rem", maxWidth: "22rem" }}>
                <FilePurposeToggle
                  purpose={purpose}
                  disabled={patchPurpose.isPending}
                  onPatch={(next) => {
                    setPurpose(next);
                    patchPurpose.mutate(next);
                  }}
                />
              </div>
            ) : f.purpose !== "generic" ? (
              <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0" }}>
                Legacy tag:{" "}
                {f.purpose === "rider_pdf" ? "Rider" : f.purpose === "plot_pdf" ? "Stage plot" : f.purpose}{" "}
                (not used for stage-wide lists; set <strong>Rider</strong> / <strong>Stage plot</strong> on each
                act’s <strong>Files</strong> page.)
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
            {isPdf && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => setViewOpen(true)}
                title="View in the app"
              >
                View
              </button>
            )}
            <a
              href={`/api/v1/files/${f.id}/raw`}
              className="icon-btn"
              target="_blank"
              rel="noreferrer"
              title="Open in a new tab"
            >
              Open
            </a>
            {canConvert && !isPdf && (
              <button
                type="button"
                className="icon-btn"
                disabled={convertToPdf.isPending}
                onClick={() => convertToPdf.mutate()}
                title="Create a PDF copy on the server (images, Word/ODT/RTF, plain text)"
              >
                {convertToPdf.isPending ? "Converting…" : "Convert to PDF"}
              </button>
            )}
            {isPdf && (
              <button type="button" className="icon-btn" onClick={openExtract} title="Extract one page as a new PDF">
                Extract
              </button>
            )}
            <button type="button" className="icon-btn danger-text" onClick={() => setDeleteOpen(true)} title="Delete file">
              Delete
            </button>
          </div>
        </div>
        {convertToPdf.isError && (
          <p role="alert" style={{ color: "var(--color-danger)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
            {(convertToPdf.error as Error).message}
          </p>
        )}
        {extractOpen && isPdf && (
          <div
            style={{
              borderTop: "1px solid var(--color-border)",
              paddingTop: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
            {previewsQ.isLoading && (
              <p className="muted" style={{ margin: "0.25rem 0" }}>Loading page previews…</p>
            )}
            {previewsQ.isError && (
              <p role="alert" style={{ color: "var(--color-danger)", fontSize: "0.85rem" }}>
                {(previewsQ.error as Error).message}
              </p>
            )}
            {previewsQ.isSuccess && pageCount > 0 && (
              <>
                <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                  Select a page (1–{pageCount}), then extract.
                </div>
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
                    const selected = page === pageIndex;
                    return (
                      <button
                        key={page}
                        type="button"
                        className="pdf-thumb-btn"
                        role="radio"
                        aria-checked={selected}
                        title={`Page ${page}`}
                        onClick={() => setPageIndex(page)}
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
                          background: selected
                            ? "color-mix(in srgb, var(--color-brand) 12%, var(--color-surface))"
                            : "var(--color-surface)",
                          boxShadow: selected
                            ? "0 0 0 1px color-mix(in srgb, var(--color-brand) 35%, transparent)"
                            : "none",
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
                        <span className="muted" style={{ fontSize: "0.75rem", textAlign: "center" }}>
                          Page {page}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.75rem" }}>
              <button
                type="button"
                className="primary"
                disabled={extract.isPending || !pageCount}
                onClick={() => extract.mutate()}
              >
                Extract as new PDF
              </button>
              <button type="button" className="icon-btn" onClick={() => setExtractOpen(false)}>
                Cancel
              </button>
            </div>
            {extract.isError && (
              <p role="alert" style={{ color: "var(--color-danger)", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                {(extract.error as Error).message}
              </p>
            )}
          </div>
        )}
      </li>
      <ConfirmDialog
        open={deleteOpen}
        title="Delete file"
        message={`Delete "${f.originalName}"?`}
        onConfirm={() => del.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
      {viewOpen && <InlinePdfViewer fileId={f.id} onClose={() => setViewOpen(false)} />}
    </>
  );
}

type Scope =
  | { kind: "stage"; stageId: string }
  | { kind: "performance"; performanceId: string; stageId: string };

export function FileAttachments({
  scope,
  title,
  /** Stage page: start collapsed so the day list stays visible; expand to manage uploads. */
  collapsedByDefault = false,
}: {
  scope: Scope;
  title: string;
  collapsedByDefault?: boolean;
}) {
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(!collapsedByDefault);
  const inputRef = useRef<HTMLInputElement>(null);
  const qk =
    scope.kind === "stage"
      ? (["files", scope.stageId] as const)
      : (["files", "performance", scope.performanceId] as const);

  const filesQ = useQuery({
    queryKey: qk,
    queryFn: () =>
      apiGet<{ files: FileAssetRow[] }>(
        scope.kind === "stage"
          ? `/api/v1/files?stageId=${scope.stageId}`
          : `/api/v1/files?performanceId=${scope.performanceId}`,
      ),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const url =
        scope.kind === "stage"
          ? `/api/v1/files?stageId=${scope.stageId}`
          : `/api/v1/files?performanceId=${scope.performanceId}`;
      return apiSendForm<{ file: FileAssetRow & { pageCount?: number } }>(url, "POST", fd);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk }); },
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (let i = 0; i < files.length; i++) upload.mutate(files[i]);
    },
    [upload],
  );

  const showPurposeToggles = scope.kind === "performance";
  const rawFiles = filesQ.data?.files ?? [];
  /** Defensive: never show performance-scoped rows on the stage list (stale cache or bad query). */
  const visibleFiles =
    scope.kind === "stage"
      ? rawFiles.filter((row) => row.performanceId == null)
      : rawFiles;

  const fileCount = visibleFiles.length;
  const countLabel = filesQ.isLoading ? "…" : String(fileCount);

  const stageScopeHelp = (
    <>
      <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "0.65rem" }}>
        Everything here is <strong>stage-wide</strong> — not linked to a single band.{" "}
        <strong>Rider</strong> and <strong>Stage plot</strong> on these rows set the <strong>shared</strong>{" "}
        defaults for this stage (one rider and one stage plot for this list). There is no performance picker;
        this screen cannot attach a file to a specific act.
      </p>
      <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "0.65rem" }}>
        For <strong>one band</strong>, go to <strong>Days</strong> on this page → open a day → use{" "}
        <strong>Files</strong> on that act’s row. Uploads there belong to that performance only; the patch
        sidebar uses those for per-act rider / stage plot preview.
      </p>
    </>
  );

  const performanceScopeHelp = (
    <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "0.65rem" }}>
      New uploads start as <strong>Other</strong>. Use <strong>Rider</strong> or <strong>Stage plot</strong>{" "}
      on each row (this list is <strong>only this act</strong>). When <strong>Convert to PDF</strong> appears,
      the server can turn images, Word/ODT/RTF, or plain text into a PDF so you can <strong>Extract</strong> a
      page.
    </p>
  );

  const showBody = !collapsedByDefault || expanded;

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <div
        className="title-bar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: showBody ? "0.75rem" : 0,
        }}
      >
        <span>{title}</span>
        {collapsedByDefault ? (
          <button
            type="button"
            className="icon-btn"
            aria-expanded={expanded}
            aria-controls={`file-attachments-${scope.kind}-${scope.kind === "stage" ? scope.stageId : scope.performanceId}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Collapse" : `Show (${countLabel})`}
          </button>
        ) : null}
      </div>

      {showBody ? (
        <div id={`file-attachments-${scope.kind}-${scope.kind === "stage" ? scope.stageId : scope.performanceId}`}>
      {scope.kind === "stage" ? stageScopeHelp : performanceScopeHelp}

      {scope.kind === "stage" && rawFiles.length > visibleFiles.length ? (
        <p role="status" className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.65rem" }}>
          {rawFiles.length - visibleFiles.length} band-scoped file(s) omitted here — open that act’s{" "}
          <strong>Files</strong> page to manage them.
        </p>
      ) : null}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "var(--color-brand)" : "var(--color-border)"}`,
          borderRadius: "var(--radius-md)",
          padding: "1.5rem",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "0.75rem",
          background: dragOver ? "var(--color-surface)" : "transparent",
          transition: "border-color 0.2s, background 0.2s",
        }}
      >
        <p className="muted" style={{ margin: 0 }}>
          {upload.isPending ? "Uploading…" : "Drop files here or click to upload"}
        </p>
        <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
          PDF, images, text, Word/ODT/RTF
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={RIDER_FILE_ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {upload.isError && (
        <p style={{ color: "var(--color-danger)" }} role="alert">
          {(upload.error as Error).message}
        </p>
      )}
      {filesQ.isLoading && <p className="muted">Loading files…</p>}
      {visibleFiles.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {visibleFiles.map((file) => (
            <FileRow
              key={file.id}
              f={file}
              queryKey={[...qk]}
              showPurposeToggles={showPurposeToggles}
            />
          ))}
        </ul>
      )}
      {filesQ.data && visibleFiles.length === 0 && !filesQ.isLoading && (
        <p className="muted">No files yet.</p>
      )}
        </div>
      ) : null}
    </div>
  );
}
