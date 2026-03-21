import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiSend, apiSendForm } from "../api/client";
import type { FileAssetPurpose, FileAssetRow } from "../api/types";

const FILE_PURPOSE_OPTIONS: { value: FileAssetPurpose; label: string }[] = [
  { value: "rider_pdf", label: "Rider / tech pack" },
  { value: "plot_pdf", label: "Stage plot" },
  { value: "plot_from_rider", label: "Plot from rider PDF" },
  { value: "generic", label: "Other" },
];
import { ConfirmDialog } from "./ConfirmDialog";

const RIDER_FILE_ACCEPT =
  "image/*,application/pdf,text/*,.pdf,.doc,.docx,.odt,.rtf,.md,.csv,.txt,.tif,.tiff,.webp,.heic,.heif";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function InlinePdfViewer({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div
        style={{ width: "90vw", height: "90vh", maxWidth: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <iframe
          src={`/api/v1/files/${fileId}/raw`}
          title="PDF viewer"
          style={{ width: "100%", height: "calc(100% - 40px)", border: "none", borderRadius: "var(--radius-md)", background: "#fff" }}
        />
      </div>
    </div>
  );
}

function FileRow({ f, queryKey }: { f: FileAssetRow; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const [purpose, setPurpose] = useState<FileAssetPurpose>(f.purpose);
  const [extractOpen, setExtractOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(1);
  const [meta, setMeta] = useState<{ pageCount?: number } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

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

  const loadMeta = async () => {
    if (f.mimeType !== "application/pdf") return;
    const r = await apiGet<{ file: FileAssetRow & { pageCount?: number } }>(`/api/v1/files/${f.id}`);
    setMeta({ pageCount: r.file.pageCount });
  };

  const openExtract = () => { setExtractOpen(true); void loadMeta(); };
  const maxPage = meta?.pageCount ?? 1;
  const isPdf = f.mimeType === "application/pdf";

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
            <label
              style={{
                display: "flex",
                gap: "0.35rem",
                alignItems: "center",
                marginTop: "0.35rem",
                fontSize: "0.8rem",
              }}
            >
              <span className="muted">Type</span>
              <select
                value={purpose}
                onChange={(e) => {
                  const v = e.target.value as FileAssetPurpose;
                  setPurpose(v);
                  patchPurpose.mutate(v);
                }}
                disabled={patchPurpose.isPending}
                aria-label="Attachment type"
              >
                {FILE_PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
            {isPdf && (
              <button type="button" className="icon-btn" onClick={() => setViewOpen(true)} title="View inline">
                👁
              </button>
            )}
            <a href={`/api/v1/files/${f.id}/raw`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center" }}>
              Open
            </a>
            {isPdf && (
              <button type="button" className="icon-btn" onClick={openExtract} title="Extract page">
                📄
              </button>
            )}
            <button type="button" className="icon-btn danger-text" onClick={() => setDeleteOpen(true)} title="Delete">
              ✕
            </button>
          </div>
        </div>
        {extractOpen && isPdf && (
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.75rem", marginTop: "0.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <label className="muted" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              Page (1–{meta?.pageCount ?? "…"})
              <input
                type="number"
                min={1}
                max={Math.max(1, maxPage)}
                value={pageIndex}
                onChange={(e) => setPageIndex(Number(e.target.value) || 1)}
                style={{ width: "5rem" }}
              />
            </label>
            <button type="button" className="primary" disabled={extract.isPending || !meta?.pageCount} onClick={() => extract.mutate()}>
              Extract as new PDF
            </button>
            <button type="button" onClick={() => setExtractOpen(false)}>Cancel</button>
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

export function FileAttachments({ scope, title }: { scope: Scope; title: string }) {
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState<FileAssetPurpose>("rider_pdf");
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
      const purpose = encodeURIComponent(uploadPurpose);
      const url =
        scope.kind === "stage"
          ? `/api/v1/files?stageId=${scope.stageId}&purpose=${purpose}`
          : `/api/v1/files?performanceId=${scope.performanceId}&purpose=${purpose}`;
      return apiSendForm<{ file: FileAssetRow & { pageCount?: number } }>(url, "POST", fd);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk }); },
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (let i = 0; i < files.length; i++) upload.mutate(files[i]);
    },
    [upload, uploadPurpose],
  );

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <div className="title-bar" style={{ marginBottom: "0.75rem" }}>{title}</div>

      <label
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "0.65rem",
          fontSize: "0.9rem",
        }}
      >
        <span className="muted">Upload as</span>
        <select
          value={uploadPurpose}
          onChange={(e) => setUploadPurpose(e.target.value as FileAssetPurpose)}
          aria-label="Type for new uploads"
        >
          {FILE_PURPOSE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

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
      {filesQ.data && filesQ.data.files.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filesQ.data.files.map((f) => (
            <FileRow key={f.id} f={f} queryKey={[...qk]} />
          ))}
        </ul>
      )}
      {filesQ.data && filesQ.data.files.length === 0 && !filesQ.isLoading && (
        <p className="muted">No files yet.</p>
      )}
    </div>
  );
}
