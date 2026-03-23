import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  apiGet,
  apiSend,
  apiSendForm,
  downloadWorkbookJson,
  readFileAsText,
} from "../api/client";
import { fetchAllPatchTemplates } from "../api/paginated";
import { ConfirmDialog } from "./ConfirmDialog";
import type {
  PaginatedPatchTemplatesResponse,
  PatchTemplatePreview,
  PatchTemplateRow,
} from "../api/types";

/** Matches server patch template acceptance (`api/src/lib/upload-allowlists.ts`). */
const PATCH_TEMPLATE_FILE_ACCEPT =
  ".xlsx,.xlsm,.xltx,.xltm,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.template,application/vnd.ms-excel.template.macroEnabled.12,application/json";

function PreviewModal({
  title,
  loading,
  preview,
  errorMessage,
  onClose,
}: {
  title: string;
  loading: boolean;
  preview: PatchTemplatePreview | null;
  errorMessage?: string | null;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal
      className="confirm-overlay"
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
        {!loading && errorMessage && (
          <p role="alert" style={{ color: "var(--color-danger)" }}>
            {errorMessage}
          </p>
        )}
        {!loading && !errorMessage && !preview && (
          <p className="muted">No preview data.</p>
        )}
        {!loading &&
          !errorMessage &&
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
  const replaceJsonRef = useRef<HTMLInputElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const TEMPLATE_PAGE = 200;
  const listQ = useInfiniteQuery({
    queryKey: ["patchTemplates"],
    queryFn: ({ pageParam }) =>
      apiGet<PaginatedPatchTemplatesResponse>(
        `/api/v1/patch-templates?page=${pageParam}&limit=${TEMPLATE_PAGE}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
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

  const createBlankTpl = useMutation({
    mutationFn: (name: string) =>
      apiSend<{ patchTemplate: { id: string } }>(
        "/api/v1/patch-templates/blank",
        "POST",
        name.trim() ? { name: name.trim() } : {},
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      setNewName("");
      navigate(`/patch-templates/${data.patchTemplate.id}/edit`);
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

  const replaceWorkbookJson = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const body = JSON.parse(text) as unknown;
      return apiSend(`/api/v1/patch-templates/${id}/sheets-import`, "PUT", body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      void qc.invalidateQueries({ queryKey: ["patchTemplate"] });
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

  const rows = listQ.data?.pages.flatMap((p) => p.patchTemplates) ?? [];

  useEffect(() => {
    if (!editId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editId]);

  return (
    <div
      className="card"
      style={{
        marginBottom: "1rem",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
        Global patch / RF templates
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        <strong>Global templates</strong> are available to all stages. Stages can also create their own{" "}
        <strong>stage templates</strong> (managed on each stage page).{" "}
        Upload Excel or <strong>create a blank template</strong>{" "}
        (two empty tabs — <strong>Input</strong> and <strong>RF</strong>) and edit in the browser.
        Use <strong>Export JSON</strong> / <strong>Import JSON</strong> to share FortuneSheet-native
        workbooks. Max 10&nbsp;MB per upload; JSON body import limit 12&nbsp;MB.
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: "1rem",
          minWidth: 0,
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
            flex: "1 1 12rem",
          }}
        >
          <span className="muted" style={{ display: "block" }}>
            Display name for next upload (optional)
          </span>
          <input
            type="text"
            placeholder="e.g. Festival default"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
          />
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
            flex: "1 1 14rem",
          }}
        >
          <span className="muted" style={{ display: "block" }}>
            Upload Excel (.xlsx, …) or FortuneSheet JSON (.json)
          </span>
          <input
            type="file"
            accept={PATCH_TEMPLATE_FILE_ACCEPT}
            disabled={createTpl.isPending || createBlankTpl.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) createTpl.mutate({ file: f, name: newName });
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="primary"
          disabled={createBlankTpl.isPending || createTpl.isPending}
          onClick={() => createBlankTpl.mutate(newName)}
          style={{ maxWidth: "100%", boxSizing: "border-box" }}
        >
          Create blank template
        </button>
      </div>

      {listQ.isPending && <p className="muted">Loading templates…</p>}
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
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    flex: "1 1 12rem",
                    overflowWrap: "anywhere",
                  }}
                >
                  <strong>{t.name}</strong>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    {" "}
                    — {t.originalName} ({(t.byteSize / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.4rem",
                    flexShrink: 0,
                  }}
                >
                  <Link
                    to={`/patch-templates/${t.id}/edit`}
                    className="button-link"
                  >
                    Edit spreadsheet
                  </Link>
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
                    Replace (Excel/JSON)
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={async () => {
                      try {
                        await downloadWorkbookJson(
                          `/api/v1/patch-templates/${t.id}/sheets-export`,
                          `${t.name}_workbook.json`,
                        );
                      } catch (err) {
                        window.alert((err as Error).message);
                      }
                    }}
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      replaceJsonRef.current?.setAttribute("data-id", t.id);
                      replaceJsonRef.current?.click();
                    }}
                  >
                    Import JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
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

      {listQ.hasNextPage && (
        <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
          <button
            type="button"
            disabled={listQ.isFetchingNextPage}
            onClick={() => void listQ.fetchNextPage()}
          >
            {listQ.isFetchingNextPage ? "Loading…" : "Load more templates"}
          </button>
        </div>
      )}

      <input
        ref={replaceRef}
        type="file"
        accept={PATCH_TEMPLATE_FILE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          const id = replaceRef.current?.getAttribute("data-id");
          const f = e.target.files?.[0];
          if (id && f) replaceTpl.mutate({ id, file: f });
          e.target.value = "";
        }}
      />

      <input
        ref={replaceJsonRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const id = replaceJsonRef.current?.getAttribute("data-id");
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!id || !f) return;
          try {
            const text = await readFileAsText(f);
            replaceWorkbookJson.mutate({ id, text });
          } catch (err) {
            window.alert((err as Error).message);
          }
        }}
      />

      {previewId && (
        <PreviewModal
          title="Template preview"
          loading={previewQ.isPending || previewQ.isFetching}
          preview={previewQ.data ?? null}
          errorMessage={
            previewQ.isError ? (previewQ.error as Error).message : null
          }
          onClose={() => setPreviewId(null)}
        />
      )}

      {editId && (
        <div
          role="dialog"
          aria-modal
          className="confirm-overlay"
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

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete template?"
        message={
          deleteTarget
            ? `Delete template "${deleteTarget.name}"? Stages that used it will need to pick another template (their default is cleared).`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteTpl.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {(createTpl.isError ||
        createBlankTpl.isError ||
        renameTpl.isError ||
        replaceTpl.isError ||
        deleteTpl.isError ||
        duplicateTpl.isError ||
        replaceWorkbookJson.isError) && (
        <p role="alert" style={{ color: "var(--color-danger)", marginTop: "0.75rem" }}>
          {(createTpl.error ??
            createBlankTpl.error ??
            renameTpl.error ??
            replaceTpl.error ??
            deleteTpl.error ??
            duplicateTpl.error ??
            replaceWorkbookJson.error)?.message}
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
  const qc = useQueryClient();
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceJsonRef = useRef<HTMLInputElement>(null);
  const newWorkbookJsonRef = useRef<HTMLInputElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [stageNewName, setStageNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const listQ = useQuery({
    queryKey: ["patchTemplates", stageId],
    queryFn: () => fetchAllPatchTemplates(stageId),
  });

  const previewQ = useQuery({
    queryKey: ["patchTemplatePreview", previewId],
    queryFn: () =>
      apiGet<PatchTemplatePreview>(
        `/api/v1/patch-templates/${previewId}/preview`,
      ),
    enabled: Boolean(previewId),
  });

  const invalidateStage = () => {
    void qc.invalidateQueries({ queryKey: ["stage", stageId] });
    void qc.invalidateQueries({ queryKey: ["stages", eventId] });
    void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
  };

  const patchStage = useMutation({
    mutationFn: (templateId: string) =>
      apiSend(`/api/v1/stages/${stageId}`, "PATCH", {
        defaultPatchTemplateId: templateId,
      }),
    onSuccess: invalidateStage,
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

  const importNewWorkbookJson = useMutation({
    mutationFn: async ({ text, name }: { text: string; name: string }) => {
      const body = JSON.parse(text) as unknown;
      const params = new URLSearchParams();
      if (name.trim()) params.set("name", name.trim());
      params.set("stageId", stageId);
      return apiSend<{ patchTemplate: { id: string } }>(
        `/api/v1/patch-templates/sheets-import?${params}`,
        "POST",
        body,
      );
    },
    onSuccess: (data) => {
      invalidateStage();
      setStageNewName("");
      patchStage.mutate(data.patchTemplate.id);
    },
  });

  const replaceWorkbookJson = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const body = JSON.parse(text) as unknown;
      return apiSend(`/api/v1/patch-templates/${id}/sheets-import`, "PUT", body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patchTemplates"] });
      void qc.invalidateQueries({ queryKey: ["patchTemplate"] });
    },
  });

  const deleteTpl = useMutation({
    mutationFn: (id: string) =>
      apiSend(`/api/v1/patch-templates/${id}`, "DELETE"),
    onSuccess: invalidateStage,
  });

  const copyToLocal = useMutation({
    mutationFn: (id: string) =>
      apiSend<{ patchTemplate: { id: string } }>(
        `/api/v1/patch-templates/${id}/duplicate`,
        "POST",
        { stageId },
      ),
    onSuccess: (data) => {
      invalidateStage();
      patchStage.mutate(data.patchTemplate.id);
    },
  });

  const createTpl = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      const params = new URLSearchParams();
      if (name.trim()) params.set("name", name.trim());
      params.set("stageId", stageId);
      return apiSendForm<{ patchTemplate: { id: string } }>(
        `/api/v1/patch-templates?${params}`,
        "POST",
        fd,
      );
    },
    onSuccess: (data) => {
      invalidateStage();
      setStageNewName("");
      patchStage.mutate(data.patchTemplate.id);
    },
  });

  const createBlankTpl = useMutation({
    mutationFn: (name: string) =>
      apiSend<{ patchTemplate: { id: string } }>(
        "/api/v1/patch-templates/blank",
        "POST",
        { name: name.trim() || undefined, stageId },
      ),
    onSuccess: (data) => {
      invalidateStage();
      setStageNewName("");
      patchStage.mutate(data.patchTemplate.id);
    },
  });

  const rows = listQ.data ?? [];
  const globalRows = rows.filter((t) => !t.stageId);
  const localRows = rows.filter((t) => t.stageId === stageId);
  const selected = rows.find((t) => t.id === defaultPatchTemplateId);
  const isLocal = selected ? selected.stageId === stageId : false;

  const summarySubtitle =
    defaultPatchTemplateId && selected
      ? `${selected.name} — ${isLocal ? "Stage template" : "Global template"}`
      : defaultPatchTemplateId && listQ.isPending
        ? "Loading…"
        : defaultPatchTemplateId
          ? "Template not in list — expand to fix"
          : rows.length === 0
            ? "No templates yet — add below or in Settings"
            : "Select a template below…";

  useEffect(() => {
    if (!editId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editId]);

  return (
    <div
      className="card"
      style={{
        marginBottom: "1.5rem",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <details
        className="stage-patch-template-details"
        key={defaultPatchTemplateId ? "has-default" : "needs-default"}
        defaultOpen={defaultPatchTemplateId == null}
      >
        <summary className="stage-patch-template-details__summary">
          <span className="stage-patch-template-details__chev" aria-hidden />
          <span className="stage-patch-template-details__summary-text">
            <span className="title-bar" style={{ marginBottom: "0.15rem", display: "block" }}>
              Default patch / RF template
            </span>
            <span
              className="muted"
              style={{
                fontSize: "0.85rem",
                textTransform: "none",
                letterSpacing: "normal",
                fontWeight: 400,
              }}
            >
              {summarySubtitle}
            </span>
          </span>
        </summary>
        <div className="stage-patch-template-details__body">
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        <strong>Global</strong> templates are shared (manage in{" "}
        <Link to="/settings">Settings</Link>).{" "}
        <strong>Stage</strong> templates belong to this stage only.
      </p>

      <div style={{ marginBottom: "0.75rem" }}>
        <label className="muted" style={{ display: "block", marginBottom: 4 }}>
          Template for new performances
        </label>
        {rows.length === 0 ? (
          <p className="muted" style={{ marginTop: 0 }}>
            No templates yet — add a global template in{" "}
            <Link to="/settings">Settings</Link>, or create a stage template below.
          </p>
        ) : (
        <select
          value={defaultPatchTemplateId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) patchStage.mutate(v);
          }}
          disabled={patchStage.isPending || listQ.isPending}
          style={{
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            padding: "0.45rem 0.6rem",
            boxSizing: "border-box",
          }}
          required
        >
          {defaultPatchTemplateId == null && (
            <option value="" disabled>
              {listQ.isPending ? "Loading templates…" : "Select a template…"}
            </option>
          )}
          {localRows.length > 0 && (
            <optgroup label="Stage templates">
              {localRows.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {globalRows.length > 0 && (
            <optgroup label="Global templates">
              {globalRows.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        )}
      </div>

      {hasPatchTemplate && selected && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm, 6px)",
            padding: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: isLocal ? "var(--color-brand)" : "var(--color-text-muted)",
              }}
            >
              {isLocal ? "Stage template" : "Global template"}
            </span>
            <div style={{ fontWeight: 500, overflowWrap: "anywhere" }}>
              {selected.name}
            </div>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              {selected.originalName}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
            }}
          >
            <Link
              to={`/patch-templates/${selected.id}/edit`}
              className="button-link"
            >
              Edit spreadsheet
            </Link>
            <button type="button" onClick={() => setPreviewId(selected.id)}>
              Preview
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await downloadWorkbookJson(
                    `/api/v1/patch-templates/${selected.id}/sheets-export`,
                    `${selected.name}_workbook.json`,
                  );
                } catch (err) {
                  window.alert((err as Error).message);
                }
              }}
            >
              Export JSON
            </button>

            {isLocal ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditId(selected.id);
                    setEditName(selected.name);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    replaceRef.current?.setAttribute("data-id", selected.id);
                    replaceRef.current?.click();
                  }}
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    replaceJsonRef.current?.setAttribute("data-id", selected.id);
                    replaceJsonRef.current?.click();
                  }}
                >
                  Import JSON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({ id: selected.id, name: selected.name })
                  }
                  disabled={deleteTpl.isPending}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={copyToLocal.isPending}
                onClick={() => copyToLocal.mutate(selected.id)}
              >
                Copy to stage template
              </button>
            )}
          </div>

          {!isLocal && (
            <p className="muted" style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.8rem" }}>
              Manage global templates in <Link to="/settings">Settings</Link>.{" "}
              <strong>Copy to stage template</strong> creates an editable local copy.
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: "0.75rem" }}>
        <span
          className="muted"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Add stage template
        </span>
        <input
          type="text"
          placeholder="Display name (optional)"
          value={stageNewName}
          onChange={(e) => setStageNewName(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "16rem",
            minWidth: 0,
            boxSizing: "border-box",
            marginBottom: "0.5rem",
          }}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            alignItems: "center",
          }}
        >
          <label
            className="button-link"
            style={{ margin: 0, cursor: "pointer" }}
          >
            Upload Excel / JSON
            <input
              type="file"
              accept={PATCH_TEMPLATE_FILE_ACCEPT}
              disabled={createTpl.isPending}
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) createTpl.mutate({ file: f, name: stageNewName });
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            disabled={importNewWorkbookJson.isPending}
            onClick={() => newWorkbookJsonRef.current?.click()}
          >
            Import workbook JSON
          </button>
          <button
            type="button"
            disabled={createBlankTpl.isPending || createTpl.isPending}
            onClick={() => createBlankTpl.mutate(stageNewName)}
          >
            Create blank
          </button>
          <input
            ref={newWorkbookJsonRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const text = await readFileAsText(f);
                importNewWorkbookJson.mutate({ text, name: stageNewName });
              } catch (err) {
                importNewWorkbookJson.reset();
                window.alert((err as Error).message);
              }
            }}
          />
        </div>
      </div>
        </div>
      </details>

      <input
        ref={replaceRef}
        type="file"
        accept={PATCH_TEMPLATE_FILE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          const id = replaceRef.current?.getAttribute("data-id");
          const f = e.target.files?.[0];
          if (id && f) replaceTpl.mutate({ id, file: f });
          e.target.value = "";
        }}
      />

      <input
        ref={replaceJsonRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const id = replaceJsonRef.current?.getAttribute("data-id");
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!id || !f) return;
          try {
            const text = await readFileAsText(f);
            replaceWorkbookJson.mutate({ id, text });
          } catch (err) {
            window.alert((err as Error).message);
          }
        }}
      />

      {previewId && (
        <PreviewModal
          title="Template preview"
          loading={previewQ.isPending || previewQ.isFetching}
          preview={previewQ.data ?? null}
          errorMessage={
            previewQ.isError ? (previewQ.error as Error).message : null
          }
          onClose={() => setPreviewId(null)}
        />
      )}

      {editId && (
        <div
          role="dialog"
          aria-modal
          className="confirm-overlay"
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

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete stage template?"
        message={
          deleteTarget
            ? `Delete stage template "${deleteTarget.name}"? This only affects this stage.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteTpl.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {(patchStage.isError ||
        createTpl.isError ||
        createBlankTpl.isError ||
        renameTpl.isError ||
        replaceTpl.isError ||
        deleteTpl.isError ||
        copyToLocal.isError ||
        importNewWorkbookJson.isError ||
        replaceWorkbookJson.isError) && (
        <p role="alert" style={{ color: "var(--color-danger)", marginTop: "0.75rem" }}>
          {(patchStage.error ??
            createTpl.error ??
            createBlankTpl.error ??
            renameTpl.error ??
            replaceTpl.error ??
            deleteTpl.error ??
            copyToLocal.error ??
            importNewWorkbookJson.error ??
            replaceWorkbookJson.error)?.message}
        </p>
      )}
    </div>
  );
}
