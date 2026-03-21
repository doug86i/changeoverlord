import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { apiGet, apiSend, apiSendForm } from "../api/client";
import type {
  PatchTemplatePreview,
  PatchTemplateRow,
} from "../api/types";

/** Matches server OOXML Excel acceptance (`api/src/lib/upload-allowlists.ts`). */
const EXCEL_TEMPLATE_ACCEPT =
  ".xlsx,.xlsm,.xltx,.xltm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.template,application/vnd.ms-excel.template.macroEnabled.12";

function PreviewModal({
  title,
  loading,
  preview,
  onClose,
}: {
  title: string;
  loading: boolean;
  preview: PatchTemplatePreview | null;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-overlay)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="card"
        style={{
          maxWidth: "min(960px, 100%)",
          maxHeight: "85vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          {title}
        </div>
        {loading && <p className="muted">Loading…</p>}
        {!loading && !preview && (
          <p className="muted">No preview data.</p>
        )}
        {!loading &&
          preview?.sheets.map((sh) => (
          <div key={sh.name} style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{sh.name}</p>
            <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
              {sh.row != null && sh.column != null
                ? `Up to ${sh.row} × ${sh.column} cells — preview sample`
                : "Preview sample"}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: "0.8rem",
                  border: "1px solid var(--color-border)",
                }}
              >
                <tbody>
                  {sh.sample.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            border: "1px solid var(--color-border)",
                            padding: "2px 6px",
                            minWidth: 28,
                            maxWidth: 120,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cell === null || cell === "" ? (
                            <span className="muted">·</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ))}
        <button type="button" onClick={onClose} style={{ marginTop: "0.5rem" }}>
          Close
        </button>
      </div>
    </div>
  );
}

export function PatchTemplateLibrarySettings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const replaceRef = useRef<HTMLInputElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");

  const listQ = useQuery({
    queryKey: ["patchTemplates"],
    queryFn: () =>
      apiGet<{ patchTemplates: PatchTemplateRow[] }>("/api/v1/patch-templates"),
  });

  const previewQ = useQuery({
    queryKey: ["patchTemplatePreview", previewId],
    queryFn: () =>
      apiGet<PatchTemplatePreview>(
        `/api/v1/patch-templates/${previewId}/preview`,
      ),
    enabled: Boolean(previewId),
  });

  const createTpl = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      const q = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
      return apiSendForm<{ patchTemplate: { id: string } }>(
        `/api/v1/patch-templates${q}`,
        "POST",
        fd,
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      setNewName("");
    },
  });

  const createFromPreset = useMutation({
    mutationFn: ({
      name,
      preset,
    }: {
      name: string;
      preset: "blank" | "example";
    }) =>
      apiSend<{ patchTemplate: { id: string } }>("/api/v1/patch-templates/new", "POST", {
        name,
        preset,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      setNewName("");
    },
  });

  const renameTpl = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiSend(`/api/v1/patch-templates/${id}`, "PATCH", { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      setEditId(null);
    },
  });

  const replaceTpl = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiSendForm(`/api/v1/patch-templates/${id}/replace`, "POST", fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
    },
  });

  const deleteTpl = useMutation({
    mutationFn: (id: string) =>
      apiSend(`/api/v1/patch-templates/${id}`, "DELETE"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const duplicateTpl = useMutation({
    mutationFn: (id: string) =>
      apiSend<{ patchTemplate: { id: string } }>(
        `/api/v1/patch-templates/${id}/duplicate`,
        "POST",
        {},
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
    },
  });

  const rows = listQ.data?.patchTemplates ?? [];

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
        Patch / RF spreadsheet templates
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Build a new workbook in the app, upload an Excel file, or use the DH
        example. Every stage can pick a template for new performances. Max
        10&nbsp;MB per upload.
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: "1rem",
        }}
      >
        <label>
          <span className="muted" style={{ display: "block", marginBottom: 4 }}>
            Name for new template
          </span>
          <input
            type="text"
            placeholder="e.g. Festival default"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ minWidth: 200 }}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
          <button
            type="button"
            className="primary"
            disabled={
              createFromPreset.isPending ||
              createTpl.isPending ||
              !newName.trim()
            }
            onClick={() =>
              createFromPreset.mutate({
                name: newName.trim(),
                preset: "blank",
              })
            }
          >
            New blank
          </button>
          <button
            type="button"
            disabled={
              createFromPreset.isPending ||
              createTpl.isPending ||
              !newName.trim()
            }
            onClick={() =>
              createFromPreset.mutate({
                name: newName.trim(),
                preset: "example",
              })
            }
          >
            New from example
          </button>
        </div>
        <label>
          <span className="muted" style={{ display: "block", marginBottom: 4 }}>
            Or upload Excel (.xlsx, .xltx, …)
          </span>
          <input
            type="file"
            accept={EXCEL_TEMPLATE_ACCEPT}
            disabled={createTpl.isPending || createFromPreset.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) createTpl.mutate({ file: f, name: newName });
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {listQ.isLoading && <p className="muted">Loading templates…</p>}
      {listQ.isError && (
        <p role="alert">Could not load templates. {(listQ.error as Error).message}</p>
      )}

      {rows.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((t) => (
            <li
              key={t.id}
              className="card"
              style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem" }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong>{t.name}</strong>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    {" "}
                    — {t.originalName} ({(t.byteSize / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/patch-templates/${t.id}/edit`)}
                  >
                    Edit spreadsheet
                  </button>
                  <button
                    type="button"
                    disabled={duplicateTpl.isPending}
                    onClick={() => duplicateTpl.mutate(t.id)}
                  >
                    Duplicate
                  </button>
                  <button type="button" onClick={() => setPreviewId(t.id)}>
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(t.id);
                      setEditName(t.name);
                    }}
                  >
                    Edit name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      replaceRef.current?.setAttribute("data-id", t.id);
                      replaceRef.current?.click();
                    }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete template “${t.name}”? Stages using it will fall back to no template.`,
                        )
                      ) {
                        deleteTpl.mutate(t.id);
                      }
                    }}
                    disabled={deleteTpl.isPending}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={replaceRef}
        type="file"
        accept={EXCEL_TEMPLATE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          const id = replaceRef.current?.getAttribute("data-id");
          const f = e.target.files?.[0];
          if (id && f) replaceTpl.mutate({ id, file: f });
          e.target.value = "";
        }}
      />

      {previewId && (
        <PreviewModal
          title="Template preview"
          loading={previewQ.isLoading}
          preview={previewQ.data ?? null}
          onClose={() => setPreviewId(null)}
        />
      )}

      {editId && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-overlay)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setEditId(null)}
        >
          <div
            className="card"
            style={{ minWidth: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
              Rename template
            </div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ width: "100%", marginBottom: "0.75rem" }}
            />
            <button
              type="button"
              className="primary"
              onClick={() =>
                renameTpl.mutate({ id: editId, name: editName.trim() || "Template" })
              }
              disabled={renameTpl.isPending}
            >
              Save
            </button>{" "}
            <button type="button" onClick={() => setEditId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(createTpl.isError ||
        createFromPreset.isError ||
        renameTpl.isError ||
        replaceTpl.isError ||
        deleteTpl.isError ||
        duplicateTpl.isError) && (
        <p style={{ color: "var(--color-brand)", marginTop: "0.75rem" }}>
          {(createTpl.error ??
            createFromPreset.error ??
            renameTpl.error ??
            replaceTpl.error ??
            deleteTpl.error ??
            duplicateTpl.error)?.message}
        </p>
      )}
    </div>
  );
}

type StagePickerProps = {
  stageId: string;
  eventId: string;
  defaultPatchTemplateId: string | null;
  hasPatchTemplate: boolean;
};

export function StagePatchTemplatePicker({
  stageId,
  eventId,
  defaultPatchTemplateId,
  hasPatchTemplate,
}: StagePickerProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const replaceRef = useRef<HTMLInputElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [stageNewName, setStageNewName] = useState("");

  const listQ = useQuery({
    queryKey: ["patchTemplates"],
    queryFn: () =>
      apiGet<{ patchTemplates: PatchTemplateRow[] }>("/api/v1/patch-templates"),
  });

  const previewQ = useQuery({
    queryKey: ["patchTemplatePreview", previewId],
    queryFn: () =>
      apiGet<PatchTemplatePreview>(
        `/api/v1/patch-templates/${previewId}/preview`,
      ),
    enabled: Boolean(previewId),
  });

  const patchStage = useMutation({
    mutationFn: (templateId: string | null) =>
      apiSend(`/api/v1/stages/${stageId}`, "PATCH", {
        defaultPatchTemplateId: templateId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stage", stageId] });
      void qc.invalidateQueries({ queryKey: ["stages", eventId] });
    },
  });

  const renameTpl = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiSend(`/api/v1/patch-templates/${id}`, "PATCH", { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      setEditId(null);
    },
  });

  const replaceTpl = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiSendForm(`/api/v1/patch-templates/${id}/replace`, "POST", fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
    },
  });

  const deleteTpl = useMutation({
    mutationFn: (id: string) =>
      apiSend(`/api/v1/patch-templates/${id}`, "DELETE"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      void qc.invalidateQueries({ queryKey: ["stage", stageId] });
      void qc.invalidateQueries({ queryKey: ["stages", eventId] });
    },
  });

  const duplicateTpl = useMutation({
    mutationFn: (id: string) =>
      apiSend<{ patchTemplate: { id: string } }>(
        `/api/v1/patch-templates/${id}/duplicate`,
        "POST",
        {},
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
    },
  });

  const createTpl = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      const q = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
      return apiSendForm(`/api/v1/patch-templates${q}`, "POST", fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      setStageNewName("");
    },
  });

  const createFromPreset = useMutation({
    mutationFn: ({
      name,
      preset,
    }: {
      name: string;
      preset: "blank" | "example";
    }) =>
      apiSend("/api/v1/patch-templates/new", "POST", {
        name,
        preset,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      setStageNewName("");
    },
  });

  const rows = listQ.data?.patchTemplates ?? [];
  const selected = rows.find((t) => t.id === defaultPatchTemplateId);

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
        Default patch / RF template
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Choose a <strong>global</strong> spreadsheet template for new performances
        on this stage. Manage all templates in Settings.
      </p>

      <div style={{ marginBottom: "0.75rem" }}>
        <label className="muted" style={{ display: "block", marginBottom: 4 }}>
          Template for new performances
        </label>
        <select
          value={defaultPatchTemplateId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            patchStage.mutate(v === "" ? null : v);
          }}
          disabled={patchStage.isPending || listQ.isLoading}
          style={{ minWidth: 280, maxWidth: "100%", padding: "0.45rem 0.6rem" }}
        >
          <option value="">— None (blank grid) —</option>
          {rows.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {hasPatchTemplate && selected && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <span className="muted" style={{ fontSize: "0.9rem" }}>
            Selected: {selected.name} ({selected.originalName})
          </span>
          <button
            type="button"
            onClick={() => navigate(`/patch-templates/${selected.id}/edit`)}
          >
            Edit spreadsheet
          </button>
          <button
            type="button"
            disabled={duplicateTpl.isPending}
            onClick={() => duplicateTpl.mutate(selected.id)}
          >
            Duplicate
          </button>
          <button type="button" onClick={() => setPreviewId(selected.id)}>
            Preview
          </button>
          <button
            type="button"
            onClick={() => {
              setEditId(selected.id);
              setEditName(selected.name);
            }}
          >
            Edit name
          </button>
          <button
            type="button"
            onClick={() => {
              replaceRef.current?.setAttribute("data-id", selected.id);
              replaceRef.current?.click();
            }}
          >
            Replace file
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Delete template “${selected.name}” from the system? Stages using it will be cleared.`,
                )
              ) {
                deleteTpl.mutate(selected.id);
              }
            }}
            disabled={deleteTpl.isPending}
          >
            Delete template
          </button>
        </div>
      )}

      <div style={{ marginTop: "0.75rem" }}>
        <span className="muted" style={{ display: "block", marginBottom: 4 }}>
          Add new template to library
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Name"
            value={stageNewName}
            onChange={(e) => setStageNewName(e.target.value)}
            style={{ maxWidth: 200 }}
          />
          <button
            type="button"
            className="primary"
            disabled={
              createFromPreset.isPending ||
              createTpl.isPending ||
              !stageNewName.trim()
            }
            onClick={() =>
              createFromPreset.mutate({
                name: stageNewName.trim(),
                preset: "blank",
              })
            }
          >
            New blank
          </button>
          <button
            type="button"
            disabled={
              createFromPreset.isPending ||
              createTpl.isPending ||
              !stageNewName.trim()
            }
            onClick={() =>
              createFromPreset.mutate({
                name: stageNewName.trim(),
                preset: "example",
              })
            }
          >
            New from example
          </button>
          <label style={{ margin: 0 }}>
            <span className="muted" style={{ marginRight: 6 }}>
              Or upload Excel
            </span>
            <input
              type="file"
              accept={EXCEL_TEMPLATE_ACCEPT}
              disabled={createTpl.isPending || createFromPreset.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) createTpl.mutate({ file: f, name: stageNewName });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <input
        ref={replaceRef}
        type="file"
        accept={EXCEL_TEMPLATE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          const id = replaceRef.current?.getAttribute("data-id");
          const f = e.target.files?.[0];
          if (id && f) replaceTpl.mutate({ id, file: f });
          e.target.value = "";
        }}
      />

      {previewId && (
        <PreviewModal
          title="Template preview"
          loading={previewQ.isLoading}
          preview={previewQ.data ?? null}
          onClose={() => setPreviewId(null)}
        />
      )}

      {editId && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-overlay)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setEditId(null)}
        >
          <div
            className="card"
            style={{ minWidth: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
              Rename template
            </div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ width: "100%", marginBottom: "0.75rem" }}
            />
            <button
              type="button"
              className="primary"
              onClick={() =>
                renameTpl.mutate({ id: editId, name: editName.trim() || "Template" })
              }
              disabled={renameTpl.isPending}
            >
              Save
            </button>{" "}
            <button type="button" onClick={() => setEditId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(patchStage.isError ||
        createTpl.isError ||
        createFromPreset.isError ||
        renameTpl.isError ||
        replaceTpl.isError ||
        deleteTpl.isError ||
        duplicateTpl.isError) && (
        <p style={{ color: "var(--color-brand)", marginTop: "0.75rem" }}>
          {(patchStage.error ??
            createTpl.error ??
            createFromPreset.error ??
            renameTpl.error ??
            replaceTpl.error ??
            deleteTpl.error ??
            duplicateTpl.error)?.message}
        </p>
      )}
    </div>
  );
}
